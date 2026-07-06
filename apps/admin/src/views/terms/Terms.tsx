"use client";

import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  FileText,
  ScrollText,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Calendar,
  UploadCloud,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  Spinner,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from "@template/ui";
import { Get, Post, Patch } from "@/shared/libs/axios/request";

interface TermsItem {
  id: string;
  title: string;
  type: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  fileId: string | null;
  file?: {
    originalName: string;
    sizeByte: string;
    localPath: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const typeLabelMap: Record<string, string> = {
  SERVICE_USE: "서비스 이용약관",
  PRIVACY_POLICY: "개인정보 수집 및 이용 동의",
  MARKETING_RECEIPT: "마케팅 정보 수신 동의",
};

const categoryBadgeStyle = (type: string) => {
  switch (type) {
    case "SERVICE_USE":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "PRIVACY_POLICY":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "MARKETING_RECEIPT":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    default:
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
};

export const TermsPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Form States
  const [type, setType] = useState("SERVICE_USE");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  // 1. Fetch all terms versions
  const { data: termsList = [], isLoading } = useQuery<TermsItem[]>({
    queryKey: ["terms", "all"],
    queryFn: async () => {
      const res = await Get<TermsItem[], unknown>("/v1/admin/terms");
      return res.data.data || [];
    },
  });

  // 2. Fetch single terms detail for preview
  const { data: previewTerms, isLoading: isPreviewLoading } = useQuery({
    queryKey: ["terms", "detail", previewId],
    queryFn: async () => {
      if (!previewId) return null;
      const res = await Get<
        { title: string; version: string; content: string },
        unknown
      >(`/v1/admin/terms/${previewId}`);
      return res.data.data;
    },
    enabled: !!previewId,
  });

  // 3. Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await Patch(`/v1/admin/terms/${id}/active`, {
        isActive: active,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("약관 활성화 상태가 변경되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "활성화 설정에 실패했습니다.";
      toast.error(msg);
    },
  });

  // 4. Create Terms Version Mutation
  const createTermsMutation = useMutation({
    mutationFn: async () => {
      let fileId: string | undefined = undefined;

      if (file) {
        const formData = new FormData();
        formData.append("files", file);

        // Content-Type 을 수동 지정하면 multipart boundary 가 누락되어
        // 서버(multer)가 파일을 파싱하지 못한다. undefined 로 두어
        // axios/브라우저가 boundary 를 포함한 헤더를 자동 생성하도록 한다.
        const uploadRes = await Post<{ id: string }[], FormData>(
          "/v1/file/upload",
          formData,
          {
            headers: { "Content-Type": undefined },
          },
        );

        const uploadedFiles = uploadRes.data.data;
        fileId = uploadedFiles?.[0]?.id;
        if (!fileId) {
          throw new Error("파일 업로드 응답에서 ID를 찾을 수 없습니다.");
        }
      } else {
        throw new Error("약관 문서를 첨부해야 합니다.");
      }

      await Post("/v1/admin/terms", {
        title,
        type,
        version,
        isRequired,
        isActive,
        fileId,
      });
    },
    onSuccess: () => {
      toast.success("신규 약관 버전이 성공적으로 등록되었습니다.");
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      resetForm();
      setIsCreateOpen(false);
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "약관 등록에 실패했습니다.";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setType("SERVICE_USE");
    setTitle("");
    setVersion("");
    setIsRequired(true);
    setIsActive(true);
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("약관명을 입력해주세요.");
    if (!version.trim()) return toast.error("버전을 입력해주세요.");
    if (!file) return toast.error("약관 파일(.html 또는 .txt)을 첨부해주세요.");
    createTermsMutation.mutate();
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    toggleActiveMutation.mutate({ id, active: !currentActive });
  };

  const filteredTerms = useMemo(
    () =>
      termsList.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.version.includes(searchQuery) ||
          typeLabelMap[t.type]
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      ),
    [termsList, searchQuery],
  );

  // 사용 중(활성) 약관을 항상 목록 최상단으로 정렬한다.
  const sortedTerms = useMemo(
    () =>
      [...filteredTerms].sort(
        (a, b) => Number(b.isActive) - Number(a.isActive),
      ),
    [filteredTerms],
  );

  // 활성 약관 행을 헤더 바로 아래에 sticky 로 고정하기 위해,
  // 헤더 높이 + 앞선 활성 행들의 높이를 누적한 top 오프셋을 런타임 측정한다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickyTops, setStickyTops] = useState<number[]>([]);

  useLayoutEffect(() => {
    const recalc = () => {
      const container = scrollRef.current;
      if (!container) return;
      const headerH =
        container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const rows = Array.from(
        container.querySelectorAll<HTMLTableRowElement>(
          "tbody tr[data-active='true']",
        ),
      );
      let acc = headerH;
      const tops = rows.map((row) => {
        const top = acc;
        acc += row.getBoundingClientRect().height;
        return top;
      });
      setStickyTops(tops);
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [sortedTerms]);

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-bold tracking-tight text-white flex items-center gap-2'>
            <ShieldCheck className='w-6 h-6 text-blue-500' />
            약관 관리
          </h1>
          <p className='text-slate-400 text-sm'>
            서비스에 적용될 회원 약관 버전을 등록하고, 약관 파일을 업로드 및
            활성화합니다.
          </p>
        </div>

        {/* Create Dialog Trigger */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className='bg-blue-600 hover:bg-blue-500 text-white gap-2 rounded-xl px-4 py-2.5 font-semibold transition-all shadow-lg shadow-blue-500/20'>
              <Plus className='w-4 h-4' />
              신규 약관 등록
            </Button>
          </DialogTrigger>
          <DialogContent className='border-slate-800 bg-slate-900 text-slate-100 max-w-md backdrop-blur-md rounded-2xl'>
            <DialogHeader>
              <DialogTitle className='text-xl font-bold text-white flex items-center gap-2'>
                <ScrollText className='w-5 h-5 text-blue-500' />
                신규 약관 등록
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className='space-y-5 pt-3'>
              {/* Category Select */}
              <div className='space-y-2'>
                <Label className='text-sm font-semibold text-slate-300'>
                  구분 (카테고리)
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className='w-full border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                    <SelectValue placeholder='약관 구분 선택' />
                  </SelectTrigger>
                  <SelectContent className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                    <SelectItem value='SERVICE_USE'>서비스 이용약관</SelectItem>
                    <SelectItem value='PRIVACY_POLICY'>
                      개인정보 수집 및 이용 동의
                    </SelectItem>
                    <SelectItem value='MARKETING_RECEIPT'>
                      마케팅 정보 수신 동의
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title Input */}
              <div className='space-y-2'>
                <Label className='text-sm font-semibold text-slate-300'>
                  약관명
                </Label>
                <Input
                  placeholder='예: 서비스 이용약관'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
                />
              </div>

              {/* Version Input */}
              <div className='space-y-2'>
                <Label className='text-sm font-semibold text-slate-300'>
                  버전
                </Label>
                <Input
                  placeholder='예: 1.0.0'
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
                />
              </div>

              {/* Switches */}
              <div className='flex items-center justify-between py-2 border-y border-slate-800'>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-sm font-semibold text-slate-300'>
                    필수 동의 여부
                  </span>
                  <span className='text-xs text-slate-500'>
                    비동의 시 가입을 차단합니다.
                  </span>
                </div>
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              </div>

              <div className='flex items-center justify-between py-2 border-b border-slate-800'>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-sm font-semibold text-slate-300'>
                    현재 버전 즉시 활성화
                  </span>
                  <span className='text-xs text-slate-500'>
                    기존 버전은 자동으로 비활성화됩니다.
                  </span>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              {/* File Upload */}
              <div className='space-y-2'>
                <Label className='text-sm font-semibold text-slate-300'>
                  약관 파일 업로드
                </Label>
                <div className='border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/50 rounded-xl p-6 transition-all relative flex flex-col items-center justify-center gap-2 text-center'>
                  <input
                    type='file'
                    accept='.html,.txt'
                    onChange={handleFileChange}
                    className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
                  />
                  <UploadCloud className='w-8 h-8 text-slate-500' />
                  {file ? (
                    <div className='text-sm text-blue-400 font-medium truncate max-w-[280px]'>
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <>
                      <div className='text-sm text-slate-400 font-medium'>
                        HTML 또는 TXT 파일 선택
                      </div>
                      <div className='text-xs text-slate-500'>
                        최대 10MB 크기 제한
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className='flex gap-2 justify-end pt-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setIsCreateOpen(false)}
                  className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl'
                >
                  취소
                </Button>
                <Button
                  type='submit'
                  disabled={createTermsMutation.isPending}
                  className='bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-1.5'
                >
                  {createTermsMutation.isPending && (
                    <Spinner className='w-4 h-4 text-white' />
                  )}
                  등록
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Table Card */}
      <Card className='border-slate-800 bg-slate-900/50 text-slate-100 backdrop-blur-sm rounded-2xl'>
        <CardHeader className='pb-3 flex flex-row items-center justify-between gap-4'>
          <div className='flex gap-2 max-w-sm w-full'>
            <Input
              type='text'
              placeholder='약관명, 구분 또는 버전 검색'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 focus:ring-blue-500 rounded-xl'
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center items-center py-20'>
              <Spinner className='w-8 h-8 text-blue-500' />
            </div>
          ) : (
            <div
              ref={scrollRef}
              className='relative max-h-[60vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/20 [&_[data-slot=table-container]]:overflow-visible'
            >
              <Table>
                <TableHeader className='border-b border-slate-800'>
                  <TableRow className='[&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:bg-slate-950'>
                    <TableHead className='text-slate-400 font-semibold py-4'>
                      구분
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      약관명
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      버전
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      필수 동의
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      활성 상태
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      첨부 파일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold'>
                      등록일
                    </TableHead>
                    <TableHead className='text-slate-400 font-semibold text-right pr-6'>
                      작업
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTerms.length > 0 ? (
                    sortedTerms.map((t, idx) => (
                      <TableRow
                        key={t.id}
                        data-active={t.isActive ? "true" : undefined}
                        style={
                          t.isActive ? { top: stickyTops[idx] ?? 0 } : undefined
                        }
                        className={`border-b transition-colors ${
                          t.isActive
                            ? "sticky z-10 border-emerald-500/20 bg-slate-900 hover:bg-slate-900"
                            : "border-slate-800/60 hover:bg-slate-800/10"
                        }`}
                      >
                        <TableCell className='py-4'>
                          <Badge
                            variant='outline'
                            className={`rounded-lg px-2.5 py-1 text-xs border ${categoryBadgeStyle(t.type)}`}
                          >
                            {typeLabelMap[t.type] || t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className='font-semibold text-slate-200'>
                          {t.title}
                        </TableCell>
                        <TableCell className='text-slate-300 font-mono'>
                          v{t.version}
                        </TableCell>
                        <TableCell>
                          {t.isRequired ? (
                            <Badge className='bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 rounded-lg'>
                              필수
                            </Badge>
                          ) : (
                            <Badge className='bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 border-slate-500/20 rounded-lg'>
                              선택
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.isActive ? (
                            <div className='flex items-center gap-1.5 text-emerald-400 text-sm font-medium'>
                              <CheckCircle className='w-4 h-4' />
                              사용 중
                            </div>
                          ) : (
                            <div className='flex items-center gap-1.5 text-slate-500 text-sm font-medium'>
                              <XCircle className='w-4 h-4' />
                              대기
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.file ? (
                            <div
                              className='flex items-center gap-1.5 text-slate-300 text-sm max-w-[180px] truncate'
                              title={t.file.originalName}
                            >
                              <FileText className='w-4 h-4 text-slate-500 shrink-0' />
                              <span className='truncate'>
                                {t.file.originalName}
                              </span>
                            </div>
                          ) : (
                            <span className='text-slate-600 text-sm'>
                              파일 없음
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-slate-400 text-sm'>
                          {new Date(t.createdAt).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className='text-right pr-6 py-4'>
                          <div className='flex items-center justify-end gap-3'>
                            {/* Preview Trigger */}
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => setPreviewId(t.id)}
                              className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl h-8 px-3 text-xs gap-1'
                            >
                              <Eye className='w-3.5 h-3.5' />
                              본문 보기
                            </Button>

                            {/* Active Switch Toggle */}
                            <div className='flex items-center gap-2'>
                              <Switch
                                checked={t.isActive}
                                onCheckedChange={() =>
                                  handleToggleActive(t.id, t.isActive)
                                }
                                disabled={toggleActiveMutation.isPending}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='text-center text-slate-500 py-16'
                      >
                        검색 조건에 맞는 약관 버전이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewId}
        onOpenChange={(open) => !open && setPreviewId(null)}
      >
        <DialogContent className='border-slate-800 bg-slate-900 text-slate-100 sm:max-w-2xl max-w-2xl max-h-[80vh] flex flex-col overflow-hidden backdrop-blur-md rounded-2xl'>
          <DialogHeader className='shrink-0 border-b border-slate-800 pb-4'>
            <DialogTitle className='text-xl font-bold text-white flex items-center gap-2 justify-between w-full pr-6'>
              <span className='flex items-center gap-2'>
                <FileText className='w-5 h-5 text-blue-500' />
                {previewTerms?.title} (v{previewTerms?.version})
              </span>
              <span className='text-xs font-mono text-slate-400 font-normal flex items-center gap-1'>
                <Calendar className='w-3 h-3' />
                본문 미리보기
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className='flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-200 rounded-xl mt-3 font-sans leading-relaxed'>
            {isPreviewLoading ? (
              <div className='flex justify-center items-center py-20'>
                <Spinner className='w-6 h-6 text-blue-500' />
              </div>
            ) : previewTerms?.content ? (
              <div
                className='prose prose-invert max-w-none prose-sm whitespace-pre-wrap'
                dangerouslySetInnerHTML={{ __html: previewTerms.content }}
              />
            ) : (
              <div className='text-center py-20 text-slate-500'>
                본문 내용을 불러올 수 없거나 파일 내용이 비어있습니다.
              </div>
            )}
          </div>

          <div className='shrink-0 flex justify-end pt-4 border-t border-slate-800 mt-3'>
            <Button
              onClick={() => setPreviewId(null)}
              className='bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl'
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
