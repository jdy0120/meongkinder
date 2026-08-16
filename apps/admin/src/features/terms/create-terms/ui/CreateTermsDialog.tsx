"use client";

import React, { useState } from "react";
import { ScrollText, Plus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Spinner,
  Switch,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Label,
} from "@pawlog/ui";

import { TERMS_TYPE_OPTIONS } from "@/entities/terms";

import { useCreateTerms } from "../model/useCreateTerms";

/**
 * 신규 약관 등록 다이얼로그 (feature ui). 트리거 버튼 + 폼 상태를 자체 소유한다.
 */
export const CreateTermsDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  const [type, setType] = useState("SERVICE_USE");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const resetForm = () => {
    setType("SERVICE_USE");
    setTitle("");
    setVersion("");
    setIsRequired(true);
    setIsActive(true);
    setFile(null);
  };

  const createTerms = useCreateTerms(() => {
    resetForm();
    setIsOpen(false);
  });

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
    createTerms.mutate({ title, type, version, isRequired, isActive, file });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className='cursor-pointer gap-2'>
          <Plus className='size-4' />
          신규 약관 등록
        </Button>
      </DialogTrigger>

      {/* 필드가 6개라 낮은 화면에서 잘린다 — 내용이 넘치면 모달 안에서 스크롤한다. */}
      <DialogContent className='max-h-[85vh] gap-5 overflow-y-auto p-6 sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-card text-foreground'>
            <ScrollText className='size-5 text-brand' />
            신규 약관 등록
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>구분 (카테고리)</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className='w-full border-transparent neu-inset'>
                <SelectValue placeholder='약관 구분 선택' />
              </SelectTrigger>
              <SelectContent>
                {TERMS_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>약관명</Label>
            <Input
              placeholder='예: 서비스 이용약관'
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitle(e.target.value)
              }
              className='border-transparent neu-inset'
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>버전</Label>
            <Input
              placeholder='예: 1.0.0'
              value={version}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setVersion(e.target.value)
              }
              className='border-transparent font-mono neu-inset'
            />
          </div>

          {/* ⚠️ 이 두 줄이 겹쳐 보이던 자리다.
              예전에는 각각 `border-y` / `border-b` 를 달고 붙어 있어서, 위 행의 아래 선과
              아래 행의 위 선이 맞닿아 **한 덩어리처럼 읽혔다.** 선으로 나누는 대신
              `.modal-row`(눌린 면)로 각자 독립된 면을 주고 사이를 띄운다 —
              뉴모피즘에서는 면이 곧 경계라 선을 겹칠 일이 없다. */}
          <div className='flex flex-col gap-3'>
            <div className='modal-row'>
              <div className='flex flex-col gap-0.5'>
                <span className='text-body-sm font-semibold text-foreground'>
                  필수 동의 여부
                </span>
                <span className='text-meta text-text-meta'>
                  비동의 시 가입을 차단합니다.
                </span>
              </div>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            </div>

            <div className='modal-row'>
              <div className='flex flex-col gap-0.5'>
                <span className='text-body-sm font-semibold text-foreground'>
                  현재 버전 즉시 활성화
                </span>
                <span className='text-meta text-text-meta'>
                  기존 버전은 자동으로 비활성화됩니다.
                </span>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-label text-text-muted'>약관 파일 업로드</Label>
            <div className='relative flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-7 text-center transition-colors neu-inset hover:border-input'>
              <input
                type='file'
                accept='.html,.txt'
                onChange={handleFileChange}
                aria-label='약관 파일 선택'
                className='absolute inset-0 size-full cursor-pointer opacity-0'
              />
              <UploadCloud className='size-8 text-text-meta' />
              {file ? (
                <div className='max-w-[280px] truncate text-body-sm font-semibold text-brand'>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <>
                  <div className='text-body-sm font-semibold text-text-muted'>
                    HTML 또는 TXT 파일 선택
                  </div>
                  <div className='text-meta text-text-meta'>
                    최대 10MB 크기 제한
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => setIsOpen(false)}
              className='cursor-pointer border-transparent bg-transparent px-5 text-text-muted neu-press'
            >
              취소
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={createTerms.isPending}
              className='cursor-pointer gap-1.5 px-5'
            >
              {createTerms.isPending && <Spinner className='size-4' />}
              등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
