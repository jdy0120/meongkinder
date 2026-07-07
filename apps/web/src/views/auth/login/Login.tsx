import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@template/ui";

import { LoginForm } from "@/features/auth/login";

/**
 * 로그인 페이지 (view). 레이아웃만 담당하고 상호작용은 features 에 위임한다.
 */
export const LoginPage = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-muted p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>로그인</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
};
