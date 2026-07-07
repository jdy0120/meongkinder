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
} from "@template/ui";

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
          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              구분 (카테고리)
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className='w-full border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                <SelectValue placeholder='약관 구분 선택' />
              </SelectTrigger>
              <SelectContent className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl'>
                {TERMS_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>
              약관명
            </Label>
            <Input
              placeholder='예: 서비스 이용약관'
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitle(e.target.value)
              }
              className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
            />
          </div>

          <div className='space-y-2'>
            <Label className='text-sm font-semibold text-slate-300'>버전</Label>
            <Input
              placeholder='예: 1.0.0'
              value={version}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setVersion(e.target.value)
              }
              className='border-slate-800 bg-slate-950 text-slate-200 rounded-xl focus:ring-blue-500'
            />
          </div>

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

          <div className='flex gap-2 justify-end pt-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsOpen(false)}
              className='border-slate-800 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl'
            >
              취소
            </Button>
            <Button
              type='submit'
              disabled={createTerms.isPending}
              className='bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-1.5'
            >
              {createTerms.isPending && <Spinner className='w-4 h-4 text-white' />}
              등록
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
