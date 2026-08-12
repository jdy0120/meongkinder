/**
 * 기존(pre-job-024) 단일 default-tenant 파일 저장 구조를 멀티테넌트 경로 구조로 이관하는 1회성 스크립트.
 *
 *   legacy: resources/uploads/<domain>/<newPath>/<filename>
 *   new:    resources/uploads/<tenantId>/<domain>/<newPath>/<filename>
 *
 * `File`/`FileTemp` 테이블의 `localPath`/`cloudPath`가 legacy 형식인 행을 찾아 물리 파일을
 * 이동(LOCAL) 하거나 Azure Blob을 copy+delete(CLOUD) 한 뒤 DB 경로를 갱신한다.
 *
 * 디스크/블롭 이동과 DB UPDATE는 원자적이지 않으므로:
 *  - 기본은 dry-run(미실행, 계획만 출력)이다. 실제 반영은 --execute 를 명시해야 한다.
 *  - --execute 로 실행하면 처리한 행마다 매니페스트 파일(JSON)에 즉시 기록한다(중단돼도 부분 매니페스트가 남는다).
 *  - --rollback <manifest.json> 으로 매니페스트를 거꾸로 재생해 원상복구할 수 있다.
 *  - 원본 파일/블롭이 없으면 해당 행은 건너뛰고(SKIPPED) DB는 건드리지 않는다 — 파일 없이 경로만
 *    바꾸면 다른 방식으로 파일-DB 불일치가 생기기 때문이다.
 *  - Azure Blob은 rename이 없어 서버사이드 copy 후 "복사 완료 확인"이 된 경우에만 원본을 삭제한다.
 *    (복사 확인 전 삭제 금지 — 실패 시 데이터 유실보다는 일시적 중복 과금 쪽을 택한다)
 *
 * 실행 (apps/api 디렉터리 기준):
 *   pnpm --filter api migrate:file-tenant-paths                                   # dry-run
 *   pnpm --filter api migrate:file-tenant-paths -- --execute                      # 실행 + 매니페스트 생성
 *   pnpm --filter api migrate:file-tenant-paths -- --rollback <manifest.json>      # 롤백 dry-run
 *   pnpm --filter api migrate:file-tenant-paths -- --rollback <manifest.json> --execute  # 롤백 실행
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { domains, type Domain } from "@pawlog/shared";
import { prisma, prismaConnect, prismaDisconnect, runWithoutTenant } from "@pawlog/database";
import { containerClient } from "../src/shared/configs/azure.config";

const LEGACY_PREFIX = "resources/uploads/";
const MANIFEST_DIR = path.join(process.cwd(), "scripts", ".migration-manifests");

type FileTable = "File" | "FileTemp";
type PathField = "localPath" | "cloudPath";
type StorageKind = "local" | "cloud";

interface PlannedChange {
  table: FileTable;
  id: string;
  field: PathField;
  storage: StorageKind;
  oldValue: string;
  newValue: string;
}

interface ManifestEntry extends PlannedChange {
  movedAt: string;
}

interface Manifest {
  createdAt: string;
  entries: ManifestEntry[];
}

function isLegacyPath(value: string, tenantId: string): boolean {
  if (!value.startsWith(LEGACY_PREFIX)) return false;
  const rest = value.slice(LEGACY_PREFIX.length);
  const firstSegment = rest.split("/")[0];
  if (firstSegment === tenantId) return false; // 이미 새 형식
  return (domains as readonly string[]).includes(firstSegment as Domain);
}

function buildNewPath(oldValue: string, tenantId: string): string {
  const rest = oldValue.slice(LEGACY_PREFIX.length); // "<domain>/<newPath>/<filename>"
  return `${LEGACY_PREFIX}${tenantId}/${rest}`;
}

function parseArgs(argv: string[]) {
  const execute = argv.includes("--execute");
  const rollbackIndex = argv.indexOf("--rollback");
  const rollbackManifest = rollbackIndex !== -1 ? argv[rollbackIndex + 1] : null;
  return { execute, rollbackManifest };
}

async function collectPlannedChanges(): Promise<PlannedChange[]> {
  const changes: PlannedChange[] = [];

  // job-033: File.tenantId 가 nullable 이 됐다(소속 없는 회원의 개인 업로드).
  // 이 스크립트는 "테넌트별 경로로 이관"이 목적이라 테넌트가 없는 파일은 대상이 아니다.
  const files = await prisma.file.findMany({ where: { tenantId: { not: null } } });
  for (const file of files) {
    const tenantId = file.tenantId!;
    if (file.localPath && isLegacyPath(file.localPath, tenantId)) {
      changes.push({
        table: "File",
        id: file.id,
        field: "localPath",
        storage: "local",
        oldValue: file.localPath,
        newValue: buildNewPath(file.localPath, tenantId),
      });
    }
    if (file.cloudPath && isLegacyPath(file.cloudPath, tenantId)) {
      changes.push({
        table: "File",
        id: file.id,
        field: "cloudPath",
        storage: "cloud",
        oldValue: file.cloudPath,
        newValue: buildNewPath(file.cloudPath, tenantId),
      });
    }
  }

  const fileTemps = await prisma.fileTemp.findMany({
    where: { tenantId: { not: null } },
  });
  for (const temp of fileTemps) {
    // FileTemp 는 항상 LOCAL(임시 디스크) 이며 legacy 형식은 "resources/temps/<filename>"(테넌트 세그먼트 없음)이다.
    if (temp.localPath && temp.localPath.startsWith("resources/temps/")) {
      const rest = temp.localPath.slice("resources/temps/".length);
      const firstSegment = rest.split("/")[0];
      if (firstSegment !== temp.tenantId) {
        changes.push({
          table: "FileTemp",
          id: temp.id,
          field: "localPath",
          storage: "local",
          oldValue: temp.localPath,
          newValue: `resources/temps/${temp.tenantId}/${rest}`,
        });
      }
    }
  }

  return changes;
}

function toAbsolute(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

function moveLocalFile(oldValue: string, newValue: string): "moved" | "missing" {
  const srcAbs = toAbsolute(oldValue);
  const destAbs = toAbsolute(newValue);
  if (!fs.existsSync(srcAbs)) return "missing";
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.renameSync(srcAbs, destAbs);
  return "moved";
}

/** 서버사이드 copy 후 복사 완료를 확인한 경우에만 원본 블롭을 삭제한다 (실패 시 원본 보존 → 중복 과금은 감수, 유실은 방지). */
async function copyAndDeleteBlob(oldValue: string, newValue: string): Promise<"moved" | "missing"> {
  if (!containerClient) {
    throw new Error(
      "Azure Storage client가 설정되지 않았습니다 (AZURE_STORAGE_CONNECTION_STRING/CONTAINER_NAME 확인).",
    );
  }
  const srcClient = containerClient.getBlockBlobClient(oldValue);
  if (!(await srcClient.exists())) return "missing";

  const destClient = containerClient.getBlockBlobClient(newValue);
  const poller = await destClient.beginCopyFromURL(srcClient.url);
  await poller.pollUntilDone();

  const copied = await destClient.exists();
  if (!copied) {
    throw new Error(
      `Blob copy 검증 실패: ${oldValue} -> ${newValue} (원본은 삭제하지 않음)`,
    );
  }

  await srcClient.delete();
  return "moved";
}

function writeManifest(manifestPath: string, manifest: Manifest) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function updateDbPath(change: PlannedChange, value: string) {
  const client = change.table === "File" ? prisma.file : prisma.fileTemp;
  await (client as { update: (args: unknown) => Promise<unknown> }).update({
    where: { id: change.id },
    data: { [change.field]: value },
  });
}

async function runMigration(execute: boolean) {
  const changes = await collectPlannedChanges();

  if (changes.length === 0) {
    console.log("이관 대상(legacy 경로) 파일이 없습니다. 할 일이 없습니다.");
    return;
  }

  console.log(`이관 대상 ${changes.length}건 발견 (${execute ? "EXECUTE" : "DRY-RUN"}):`);
  for (const change of changes) {
    console.log(`  [${change.table}#${change.id}] ${change.field}: ${change.oldValue} -> ${change.newValue}`);
  }

  if (!execute) {
    console.log("\ndry-run 모드입니다. 실제로 반영하려면 --execute 플래그를 추가하세요.");
    return;
  }

  const manifestPath = path.join(MANIFEST_DIR, `migrate-${Date.now()}.json`);
  const manifest: Manifest = { createdAt: new Date().toISOString(), entries: [] };

  let movedCount = 0;
  let skippedCount = 0;

  for (const change of changes) {
    try {
      const result =
        change.storage === "local"
          ? moveLocalFile(change.oldValue, change.newValue)
          : await copyAndDeleteBlob(change.oldValue, change.newValue);

      if (result === "missing") {
        console.warn(
          `  SKIP (원본 없음): [${change.table}#${change.id}] ${change.oldValue}`,
        );
        skippedCount++;
        continue;
      }

      await updateDbPath(change, change.newValue);

      manifest.entries.push({ ...change, movedAt: new Date().toISOString() });
      writeManifest(manifestPath, manifest); // 매 건마다 즉시 flush — 중단돼도 부분 매니페스트가 남는다.
      movedCount++;
    } catch (error) {
      console.error(
        `  ERROR: [${change.table}#${change.id}] ${change.field} 이관 실패, 이 행은 건너뜁니다.`,
        error,
      );
      skippedCount++;
    }
  }

  console.log(
    `\n완료: ${movedCount}건 이관, ${skippedCount}건 건너뜀. 매니페스트: ${manifest.entries.length > 0 ? manifestPath : "(생성 안 됨 — 성공 건 없음)"}`,
  );
  if (skippedCount > 0) {
    console.warn(
      "건너뛴 행이 있습니다 — 원본 파일이 디스크/블롭에 없거나 이관 중 오류가 발생한 경우입니다. 로그를 확인해 수동 조치하세요.",
    );
  }
}

async function runRollback(manifestPath: string, execute: boolean) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`매니페스트 파일을 찾을 수 없습니다: ${manifestPath}`);
  }
  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  if (manifest.entries.length === 0) {
    console.log("매니페스트에 롤백할 항목이 없습니다.");
    return;
  }

  console.log(
    `매니페스트 ${manifestPath} 의 ${manifest.entries.length}건을 롤백합니다 (${execute ? "EXECUTE" : "DRY-RUN"}):`,
  );

  const remaining: ManifestEntry[] = [];
  let rolledBack = 0;
  let failed = 0;

  // 이관의 역순으로 되돌린다.
  for (const entry of [...manifest.entries].reverse()) {
    console.log(
      `  [${entry.table}#${entry.id}] ${entry.field}: ${entry.newValue} -> ${entry.oldValue}`,
    );

    if (!execute) {
      remaining.push(entry);
      continue;
    }

    try {
      const result =
        entry.storage === "local"
          ? moveLocalFile(entry.newValue, entry.oldValue)
          : await copyAndDeleteBlob(entry.newValue, entry.oldValue);

      if (result === "missing") {
        console.warn(
          `  SKIP (이관된 파일이 현재 위치에 없음): [${entry.table}#${entry.id}] ${entry.newValue}`,
        );
        remaining.push(entry);
        failed++;
        continue;
      }

      await updateDbPath(
        { ...entry, oldValue: entry.newValue, newValue: entry.oldValue },
        entry.oldValue,
      );
      rolledBack++;
    } catch (error) {
      console.error(`  ERROR: [${entry.table}#${entry.id}] 롤백 실패, 매니페스트에 남겨둡니다.`, error);
      remaining.push(entry);
      failed++;
    }
  }

  if (!execute) {
    console.log("\ndry-run 모드입니다. 실제로 롤백하려면 --execute 플래그를 추가하세요.");
    return;
  }

  manifest.entries = remaining;
  writeManifest(manifestPath, manifest);
  console.log(
    `\n롤백 완료: ${rolledBack}건 복구, ${failed}건 실패(매니페스트에 남음). 매니페스트: ${manifestPath}`,
  );
}

async function main() {
  const { execute, rollbackManifest } = parseArgs(process.argv.slice(2));

  await prismaConnect();
  try {
    await runWithoutTenant(async () => {
      if (rollbackManifest) {
        await runRollback(rollbackManifest, execute);
      } else {
        await runMigration(execute);
      }
    });
  } finally {
    await prismaDisconnect();
  }
}

main().catch((error) => {
  console.error("스크립트 실행 중 처리되지 않은 오류가 발생했습니다:", error);
  process.exitCode = 1;
});
