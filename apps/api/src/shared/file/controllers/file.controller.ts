import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FILE_ROUTES } from "../routes";
import { FileService } from "../services/file.service";
import { getMulterOptions } from "../../utils/file";
import { FileUploadDto } from "../dtos/file-upload.dto";
import { FileResponseDto } from "../dtos/file-response.dto";

@ApiTags("File")
@Controller(FILE_ROUTES.v1.BASE)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post(FILE_ROUTES.v1.UPLOAD)
  @ApiOperation({ summary: "다중 파일 임시 업로드" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description: "업로드할 파일 목록",
    type: FileUploadDto,
  })
  @ApiResponse({
    status: 201,
    description: "임시 업로드 성공 및 파일 메타데이터 목록 반환",
    type: [FileResponseDto],
  })
  @UseInterceptors(FilesInterceptor("files", undefined, getMulterOptions()))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FileResponseDto[]> {
    return this.fileService.uploadsTemp(files);
  }
}
