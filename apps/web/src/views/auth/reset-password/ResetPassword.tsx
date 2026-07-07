import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@template/ui";

import { ResetPasswordForm } from "@/features/auth/reset-password";

/**
 * 비밀번호 재설정 페이지 (view). URL 토큰을 폼으로 전달한다.
 */
export const ResetPasswordPage = ({ token }: { token?: string }) => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-muted p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>비밀번호 재설정</CardTitle>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </div>
  );
};
