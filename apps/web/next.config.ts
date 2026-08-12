import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@pawlog/database"],
  // 테넌트 서브도메인 로컬 개발(lvh.me / *.localhost)에서 dev 서버로 접속할 때
  // Next dev 서버의 cross-origin 요청 차단(HMR/RSC 등)을 피하기 위한 허용 목록.
  // docs/local-tenant-dev.md 참고. 프로덕션(output: standalone)에는 영향 없음.
  allowedDevOrigins: ["*.lvh.me", "*.localhost", "*.pawlog-dev.doyeonism.com"],
};

export default nextConfig;
