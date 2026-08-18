"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  RequestPhoneOtpRequest,
  RequestPhoneOtpResponse,
  VerifyPhoneOtpRequest,
  VerifyPhoneOtpResponse,
} from "@pawlog/shared";

import { Post } from "@/shared/libs/axios/request";

/**
 * 인증번호 발송 (job-042).
 *
 * 서버가 재발송 쿨다운(429)·일일 한도(429)·미설정(503)을 각각 다른 메시지로 돌려주므로
 * 그대로 보여준다 — "실패했습니다"로 뭉개면 사용자는 30초를 기다려야 하는지 번호를
 * 잘못 넣은 건지 알 수 없다.
 */
export const useRequestPhoneOtp = (handlers?: {
  onSent?: (expiresInSec: number) => void;
  /** 이미 다른 계정이 쓰는 번호(409). 토스트 대신 모달로 안내한다. */
  onDuplicate?: (message: string) => void;
}) =>
  useMutation({
    mutationFn: async (phone: string) => {
      const res = await Post<RequestPhoneOtpResponse, RequestPhoneOtpRequest>(
        "/v1/auth/phone/otp",
        { phone },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success("인증번호를 문자로 보냈습니다.");
      handlers?.onSent?.(data?.expiresInSec ?? 300);
    },
    onError: (error) => {
      const message = error.response?.data?.message;

      // 409 = 이미 다른 계정에 등록된 번호. 이것만 토스트가 아니라 모달이다.
      //
      // 나머지 실패(쿨다운·일일 한도·미설정)는 "잠시 뒤 다시 하면 되는" 일이라 흐름을
      // 끊지 않는 편이 낫다. 반면 중복은 **다시 시도해도 영영 안 되는** 상태라, 사라지는
      // 토스트로 알리면 사용자는 같은 번호로 '인증요청'만 반복하게 된다. 무엇을 해야
      // 하는지(다른 계정으로 로그인 / 다른 번호 입력)를 읽고 닫아야 다음 행동이 정해진다.
      if (error.response?.status === 409 && handlers?.onDuplicate) {
        handlers.onDuplicate(
          message ?? "이미 다른 계정에 등록된 휴대폰 번호입니다.",
        );
        return;
      }

      toast.error(message ?? "인증번호를 보내지 못했습니다.");
    },
  });

/** 인증번호 확인. 성공하면 서버에 "이 사람이 이 번호를 가졌다"는 표시가 남는다(10분). */
export const useVerifyPhoneOtp = (onVerified?: () => void) =>
  useMutation({
    mutationFn: async (payload: VerifyPhoneOtpRequest) => {
      const res = await Post<VerifyPhoneOtpResponse, VerifyPhoneOtpRequest>(
        "/v1/auth/phone/otp/verify",
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("휴대폰 본인확인이 완료되었습니다.");
      onVerified?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message ?? "확인에 실패했습니다.");
    },
  });
