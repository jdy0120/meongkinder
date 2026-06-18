import { ApiProperty } from "@nestjs/swagger";

export class FileUploadDto {
  @ApiProperty({
    type: "array",
    items: { type: "string", format: "binary" },
    description: "업로드할 파일 리스트",
  })
  files: any[];
}
