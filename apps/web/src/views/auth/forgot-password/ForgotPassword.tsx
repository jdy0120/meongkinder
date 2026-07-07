import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@template/ui";

import { ForgotPasswordForm } from "@/features/auth/forgot-password";

/**
 * 비밀번호 찾기 페이지 (view). 레이아웃만 담당한다.
 */
export const ForgotPasswordPage = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-muted p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>비밀번호 찾기</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
};
