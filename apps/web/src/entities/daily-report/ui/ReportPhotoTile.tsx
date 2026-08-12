import { PhotoImage } from "@/entities/file";

/** 리포트 사진 항목 타일 — fileId 로 v1/file/:fileId 를 조회해 실제 이미지를 보여준다. */
export const ReportPhotoTile = ({
  fileId,
  className,
}: {
  fileId: string;
  className?: string;
}) => (
  <PhotoImage
    fileId={fileId}
    alt='리포트 사진'
    className={`rounded-xl object-cover ${className ?? ""}`}
  />
);
