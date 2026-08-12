import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { runWithoutTenant } from "@pawlog/database";
import { FileService } from "./file.service";

@Injectable()
export class FileSchedulerService {
  private readonly logger = new Logger(FileSchedulerService.name);

  constructor(private readonly fileService: FileService) {}

  // 매일 새벽 4시에 하루가 지난 임시 파일 및 DB 레코드 자동 정리.
  // 테넌트 무관 전역 정리 배치이므로 bypass 컨텍스트에서 실행한다.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleTempCleanup() {
    this.logger.log("오래된 임시 파일 자동 정리 배치를 시작합니다...");
    try {
      const deletedCount = await runWithoutTenant(() =>
        this.fileService.cleanOldTempFiles(),
      );
      if (deletedCount > 0) {
        this.logger.log(
          `오래된 임시 파일 ${deletedCount}개가 디스크 및 DB에서 정리되었습니다.`,
        );
      } else {
        this.logger.log("정리할 오래된 임시 파일이 없습니다.");
      }
    } catch (error) {
      this.logger.error("임시 파일 정리 배치 중 오류가 발생했습니다:", error);
    }
  }
}
