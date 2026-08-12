// 파일 서빙 API 계약 (GET v1/file/:fileId)

export interface FileUrlResponse {
  id: string;
  url: string; // Azure Blob SAS URL(CLOUD) 또는 정적 서빙 URL(LOCAL, 개발 환경)
  originalName: string;
  mimeType: string;
}
