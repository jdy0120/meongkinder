import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { FILE_ROUTES } from "../routes";
import { FileService } from "../services/file.service";
import { getMulterOptions } from "../../utils/file";
import { FileUploadDto } from "../dtos/file-upload.dto";
import { FileResponseDto } from "../dtos/file-response.dto";
import { FileUrlResponseDto } from "../dtos/file-url-response.dto";

@ApiTags("File")
@ApiBearerAuth()
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
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<FileResponseDto[]> {
    return this.fileService.uploadsTemp(files, req.user?.userId ?? null);
  }

  @Get(FILE_ROUTES.v1.GET_FILE)
  @ApiOperation({
    summary: "파일 조회 (접근 가능한 URL 반환)",
    description:
      "fileId에 해당하는 파일의 URL을 반환한다. CLOUD 저장 파일은 Azure Blob SAS URL을, LOCAL 저장 파일은 인증된 스트리밍 엔드포인트(raw) URL을 반환한다.",
  })
  @ApiParam({ name: "fileId", description: "File.id" })
  @ApiResponse({
    status: 200,
    description: "파일 URL 조회 성공",
    type: FileUrlResponseDto,
  })
  async getFile(@Param("fileId") fileId: string): Promise<FileUrlResponseDto> {
    return this.fileService.getFileUrl(fileId);
  }

  @Get(FILE_ROUTES.v1.GET_FILE_RAW)
  @ApiOperation({
    summary: "파일 원본 스트리밍",
    description:
      "인증 및 테넌트 소유권 검사를 거쳐 LOCAL 저장 파일의 바이너리를 직접 스트리밍한다.",
  })
  @ApiParam({ name: "fileId", description: "File.id" })
  @ApiResponse({ status: 200, description: "파일 스트림" })
  async getFileRaw(
    @Param("fileId") fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, originalName, mimeType, sizeByte } =
      await this.fileService.streamFile(fileId);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", sizeByte);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(originalName)}"`,
    );

    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }
}
