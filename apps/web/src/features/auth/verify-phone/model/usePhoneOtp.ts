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
export const useRequestPhoneOtp = (onSent?: (expiresInSec: number) => void) =>
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
      onSent?.(data?.expiresInSec ?? 300);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message ?? "인증번호를 보내지 못했습니다.",
      );
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
