"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pawlog/ui";
import { formatPhone } from "@pawlog/shared";
import type { Pet } from "@pawlog/database";

interface SyncPetPhoneDialogProps {
  open: boolean;
  /** 옛 번호로 알림을 받고 있는 내 아이들. 비어 있으면 이 다이얼로그는 뜨지 않는다. */
  pets: Pet[];
  previousPhone: string;
  newPhone: string;
  onCancel: () => void;
  onConfirm: (petIds: string[]) => void;
  isPending?: boolean;
}

/**
 * 번호 변경 시 아이들의 알림 수신 번호도 함께 옮길지 확인한다 (job-060).
 *
 * ## 왜 물어보는가
 *
 * 알림톡 수신처는 `Pet.guardianPhone → User.phone` 순으로 정해진다. 매장이 현장에서
 * 적어 둔 번호가 계정 번호를 이기므로, **회원 정보에서 번호만 바꾸면 알림은 계속 옛
 * 번호로 간다.** 보호자는 알림이 안 와서 앱을 열어보고, 매장은 발송 성공 로그를 본다.
 *
 * 그렇다고 전부 자동으로 덮으면 안 된다 — 부모 계정으로 가입했지만 등하원과 연락은
 * 자녀가 맡는 식으로 **일부러 다른 번호를 적어 둔 경우**가 있고, 덮으면 그 아이의
 * 알림이 엉뚱한 곳으로 간다. 그래서 여기 오는 목록은 **옛 번호를 그대로 쓰던 아이**뿐이고,
 * 그중에서도 사용자가 고른 것만 넘어간다.
 *
 * 번호가 재활용된다는 점이 이 화면의 진짜 이유다 — 옛 번호는 몇 달 뒤 다른 사람에게
 * 재배정되고, 그 사람에게 남의 아이 사진과 (로그인이 필요 없는) 공개 알림장 링크가 간다.
 */
export const SyncPetPhoneDialog = ({
  open,
  pets,
  previousPhone,
  newPhone,
  onCancel,
  onConfirm,
  isPending,
}: SyncPetPhoneDialogProps) => {
  // 기본은 전부 선택. 대부분은 번호를 옮기는 게 맞고, 예외인 사람만 체크를 푼다.
  const [selected, setSelected] = useState<string[]>(() =>
    pets.map((pet) => pet.id),
  );

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>아이들의 알림 번호도 바꿀까요?</DialogTitle>
          <DialogDescription>
            아래 아이들은 아직 {formatPhone(previousPhone)} 로 알림을 받고
            있습니다. 바꾸지 않으면 등하원·알림장이 계속 옛 번호로 갑니다.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-2 py-2'>
          {pets.map((pet) => (
            <label
              key={pet.id}
              className='flex min-h-touch cursor-pointer items-center gap-3 rounded-btn border p-3'
            >
              <Checkbox
                checked={selected.includes(pet.id)}
                onCheckedChange={() => toggle(pet.id)}
              />
              <span className='font-semibold'>{pet.name}</span>
            </label>
          ))}
        </div>

        <p className='text-label text-muted-foreground'>
          새 번호: {formatPhone(newPhone)}
        </p>

        <div className='flex justify-end gap-2 pt-1'>
          {/*
            "번호만 바꾸기"도 정상적인 선택지다 — 아이 연락처를 일부러 다르게 둔 사람이
            있다. 다만 기본 버튼은 함께 바꾸는 쪽이다.
          */}
          <Button
            type='button'
            variant='outline'
            disabled={isPending}
            onClick={() => onConfirm([])}
          >
            내 번호만 바꾸기
          </Button>
          <Button
            type='button'
            disabled={isPending}
            onClick={() => onConfirm(selected)}
          >
            {isPending ? "저장 중…" : "함께 바꾸기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
