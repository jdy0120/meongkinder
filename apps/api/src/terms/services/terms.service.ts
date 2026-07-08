import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@template/database";
import * as fs from "fs";
import * as path from "path";
import { FileService } from "../../shared/file/services/file.service";
import { CreateTermsDto, SubmitTermsAgreementDto } from "../dtos";

@Injectable()
export class TermsService {
  constructor(private readonly fileService: FileService) {}

  /** 활성화된 약관 목록 조회 및 로컬 파일 본문 병합 */
  async listActiveTerms() {
    const termsList = await prisma.terms.findMany({
      where: { isActive: true },
      include: { file: true },
      orderBy: { createdAt: "asc" },
    });

    return Promise.all(
      termsList.map(async (t) => {
        let content = "약관 파일이 등록되지 않았습니다.";
        if (t.file?.localPath) {
          try {
            const absolutePath = path.join(process.cwd(), t.file.localPath);
            content = await fs.promises.readFile(absolutePath, "utf8");
          } catch (_err) {
            content = "약관 파일을 읽어올 수 없습니다.";
          }
        }
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          version: t.version,
          content,
          isRequired: t.isRequired,
          isActive: t.isActive,
          fileId: t.fileId,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
      }),
    );
  }

  /** 사용자의 약관 동의 이력 제출 */
  async submitAgreements(userId: string, dto: SubmitTermsAgreementDto) {
    const termsIds = dto.agreements.map((a) => a.termsId);

    // 존재하는 약관들인지 사전 확인
    const existingTerms = await prisma.terms.findMany({
      where: { id: { in: termsIds } },
    });

    if (existingTerms.length !== termsIds.length) {
      throw new BadRequestException(
        "존재하지 않는 약관 ID가 포함되어 있습니다.",
      );
    }

    const agreements = await prisma.$transaction(async (tx) => {
      const createdAgreements = [];
      for (const ag of dto.agreements) {
        const created = await tx.userTermsAgreement.create({
          data: {
            userId,
            termsId: ag.termsId,
            isAgreed: ag.isAgreed,
          },
        });
        createdAgreements.push(created);
      }
      return createdAgreements;
    });

    return { agreements };
  }

  // ── 어드민 관리자 전용 비즈니스 로직 ──────────────────────────────────────

  /** 모든 약관 버전 목록 조회 (어드민용) */
  async listAllTerms() {
    return prisma.terms.findMany({
      include: { file: true },
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
  }

  /** 약관 상세 정보 조회 (로컬 파일 본문 포함) */
  async getTermsDetail(id: string) {
    const terms = await prisma.terms.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!terms) {
      throw new NotFoundException("존재하지 않는 약관입니다.");
    }

    let content = "약관 파일이 등록되지 않았습니다.";
    if (terms.file?.localPath) {
      try {
        const absolutePath = path.join(process.cwd(), terms.file.localPath);
        content = await fs.promises.readFile(absolutePath, "utf8");
      } catch (_err) {
        content = "약관 파일을 읽어올 수 없습니다.";
      }
    }

    return {
      ...terms,
      content,
    };
  }

  /** 새로운 약관 등록 (로컬 파일 저장 연동) */
  async createTerms(dto: CreateTermsDto) {
    // 동일 type + 동일 version 중복 방지
    const exists = await prisma.terms.findUnique({
      where: {
        type_version: {
          type: dto.type,
          version: dto.version,
        },
      },
    });

    if (exists) {
      throw new ConflictException(
        "해당 카테고리에 이미 동일한 버전이 존재합니다.",
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. 만약 새로 만드는 약관을 활성화(isActive: true)하려 한다면, 기존 활성 약관들을 비활성화
      if (dto.isActive) {
        await tx.terms.updateMany({
          where: { type: dto.type, isActive: true },
          data: { isActive: false },
        });
      }

      // 2. 만약 임시 업로드된 파일 ID가 전송되었다면 로컬 업로드 디렉토리로 이동
      if (dto.fileId) {
        await this.fileService.moveTempsToUploadsLocal({
          fileList: [{ id: dto.fileId }],
          domain: "terms",
          newPath: `${dto.type}/${dto.version}`,
          tx: tx,
        });
      }

      // 3. 약관 레코드 생성
      return tx.terms.create({
        data: {
          title: dto.title,
          type: dto.type,
          version: dto.version,
          fileId: dto.fileId || null,
          isRequired: dto.isRequired,
          isActive: dto.isActive,
        },
      });
    });
  }

  /** 약관 활성화 여부 토글 */
  async updateTermsActive(id: string, isActive: boolean) {
    const terms = await prisma.terms.findUnique({ where: { id } });
    if (!terms) {
      throw new NotFoundException("존재하지 않는 약관입니다.");
    }

    return prisma.$transaction(async (tx) => {
      // 만약 활성화 처리를 한다면, 동일 카테고리(type)의 다른 모든 버전을 비활성화
      if (isActive) {
        await tx.terms.updateMany({
          where: { type: terms.type, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.terms.update({
        where: { id },
        data: { isActive },
      });
    });
  }
}
