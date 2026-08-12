import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import {
  FEED_MEDIA_TYPE,
  FEED_POST_STATUS,
  FEED_TAG_SOURCE,
} from "@pawlog/shared";
import type {
  CreateFeedMediaRequest,
  CreateFeedPostRequest,
  CreateFeedTagRequest,
  RunFeedDigestRequest,
  SuggestFeedTagsRequest,
  UpdateFeedPostRequest,
} from "@pawlog/shared";
import { PaginationQueryDto } from "../../shared/dtos";

const MEDIA_TYPES = Object.values(FEED_MEDIA_TYPE);
const POST_STATUSES = Object.values(FEED_POST_STATUS);
const TAG_SOURCES = Object.values(FEED_TAG_SOURCE);

/**
 * 피드 목록 조회 쿼리.
 * 전역 ValidationPipe 가 whitelist 를 강제하므로 date/petId 필터는 PaginationQueryDto 를
 * 상속한 전용 DTO 로 선언해야 400 이 나지 않는다.
 */
export class FeedPostQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "대상 일자로 필터링 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ description: "태그된 반려동물 ID로 필터링" })
  @IsOptional()
  @IsString()
  petId?: string;
}

export class CreateFeedMediaDto implements CreateFeedMediaRequest {
  @ApiProperty({ description: "v1/file/upload 응답의 File.id" })
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  @ApiPropertyOptional({
    description: "IMAGE(기본) | VIDEO",
    enum: MEDIA_TYPES,
  })
  @IsOptional()
  @IsIn(MEDIA_TYPES)
  type?: string;

  @ApiPropertyOptional({ description: "노출 순서" })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateFeedTagDto implements CreateFeedTagRequest {
  @ApiProperty({ description: "이 사진에 등장한 반려동물 ID" })
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @ApiProperty({
    description:
      "이 아이가 찍힌 사진의 File.id (같은 요청의 media[].fileId 중 하나여야 한다)",
  })
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  @ApiPropertyOptional({
    description: "태그의 출처 (AI 제안 | MANUAL 사람이 직접)",
    enum: TAG_SOURCES,
  })
  @IsOptional()
  @IsIn(TAG_SOURCES)
  source?: string;

  @ApiPropertyOptional({ description: "AI 제안일 때의 확신도 (0~1)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({ description: "사람이 눈으로 확인했는지" })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class CreateFeedPostDto implements CreateFeedPostRequest {
  @ApiPropertyOptional({
    description: "대상 일자 (ISO 8601, 미지정 시 오늘)",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ description: "캡션" })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({
    description:
      "DRAFT(기본) | PUBLISHED — PUBLISHED 로 보내면 즉시 팬아웃된다",
    enum: POST_STATUSES,
  })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: string;

  @ApiProperty({
    description: "사진/영상 목록 (최소 1장)",
    type: [CreateFeedMediaDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedMediaDto)
  media!: CreateFeedMediaDto[];

  @ApiPropertyOptional({
    description: "이 게시물에 등장한 아이들 (팬아웃 대상)",
    type: [CreateFeedTagDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedTagDto)
  tags?: CreateFeedTagDto[];

  @ApiPropertyOptional({
    description:
      "AI 가 제안했던 아이 전체 (사람이 최종적으로 뺀 아이 포함). 거절당한 제안을 학습 데이터로 남기는 데 쓴다.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedPetIds?: string[];
}

export class UpdateFeedPostDto implements UpdateFeedPostRequest {
  @ApiPropertyOptional({ description: "대상 일자 (ISO 8601)" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ description: "캡션" })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({
    description: "DRAFT | PUBLISHED",
    enum: POST_STATUSES,
  })
  @IsOptional()
  @IsIn(POST_STATUSES)
  status?: string;

  @ApiPropertyOptional({
    description:
      "태그 최종 명단 (전달 시 전체 대체). AI 제안과 달라진 부분은 학습 데이터로 기록된다.",
    type: [CreateFeedTagDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFeedTagDto)
  tags?: CreateFeedTagDto[];
}

export class SuggestFeedTagsDto implements SuggestFeedTagsRequest {
  @ApiProperty({
    description: "방금 업로드한 사진의 File.id 목록",
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  fileIds!: string[];

  @ApiPropertyOptional({
    description: "후보를 좁힐 기준 일자 (ISO 8601, 미지정 시 오늘)",
  })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class FeedCaptionDraftDto {
  @ApiProperty({ description: "태그된 반려동물 ID 목록", type: [String] })
  @IsArray()
  @IsString({ each: true })
  petIds!: string[];
}

export class FeedCoverageQueryDto {
  @ApiPropertyOptional({ description: "기준 일자 (ISO 8601, 미지정 시 오늘)" })
  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class RunFeedDigestDto implements RunFeedDigestRequest {
  @ApiPropertyOptional({ description: "기준 일자 (ISO 8601, 미지정 시 오늘)" })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({
    description: "생성된 리포트를 즉시 발행할지 (기본 false — 검수 후 발행)",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
