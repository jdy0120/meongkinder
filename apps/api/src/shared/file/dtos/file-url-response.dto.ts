import { ApiProperty } from "@nestjs/swagger";
import type { FileUrlResponse } from "@pawlog/shared";

export class FileUrlResponseDto implements FileUrlResponse {
  @ApiProperty({
    description: "파일 ID",
    example: "45f9a0c0-6725-4c03-bb9e-4b68ff7b63f5",
  })
  id: string;

  @ApiProperty({
    description:
      "접근 가능한 파일 URL (운영: Azure Blob SAS URL / 개발: 로컬 정적 서빙 URL)",
    example:
      "http://localhost:3000/resources/uploads/daily-report/xxx/photo.jpg",
  })
  url: string;

  @ApiProperty({ description: "원본 파일명", example: "photo.jpg" })
  originalName: string;

  @ApiProperty({ description: "MIME 타입", example: "image/jpeg" })
  mimeType: string;
}
