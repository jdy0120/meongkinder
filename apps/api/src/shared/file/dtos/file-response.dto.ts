import { ApiProperty } from "@nestjs/swagger";

export class FileResponseDto {
  @ApiProperty({
    description: "파일 ID",
    example: "45f9a0c0-6725-4c03-bb9e-4b68ff7b63f5",
  })
  id: string;

  @ApiProperty({ description: "원본 파일명", example: "tennis_demo.zip" })
  originalName: string;

  @ApiProperty({ description: "파일 확장자", example: ".zip" })
  extension: string;

  @ApiProperty({ description: "MIME 타입", example: "application/zip" })
  mimeType: string;

  @ApiProperty({ description: "파일 크기 (바이트)", example: 1048576 })
  sizeByte: number;

  @ApiProperty({
    description: "로컬 저장 경로",
    example: "resources/temps/1672500000000_abc123.zip",
    nullable: true,
  })
  localPath: string | null;

  @ApiProperty({
    description: "클라우드 저장 경로",
    example: null,
    nullable: true,
  })
  cloudPath: string | null;

  @ApiProperty({ description: "저장소 상태", example: "LOCAL" })
  storageStatus: string;

  @ApiProperty({ description: "MD5 체크섬", example: null, nullable: true })
  checksumMd5: string | null;

  @ApiProperty({ description: "SHA256 체크섬", example: null, nullable: true })
  checksumSha256: string | null;

  @ApiProperty({ description: "업로드 주체 ID", example: null, nullable: true })
  uploadedBy: string | null;

  @ApiProperty({ description: "동기화 시간", example: null, nullable: true })
  syncedAt: Date | null;

  @ApiProperty({ description: "삭제 시간", example: null, nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ description: "생성 시간" })
  createdAt: Date;

  @ApiProperty({ description: "수정 시간" })
  updatedAt: Date;
}
