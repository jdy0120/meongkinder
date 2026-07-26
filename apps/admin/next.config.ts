import type { NextConfig } from "next";

// dev: nginx가 /admin/ 경로로 프록시하므로 basePath 필요.
// prod: admin이 자체 도메인/포트 루트에서 서빙되므로 미설정(undefined) 유지.
const basePath = process.env.ADMIN_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@pawlog/database"],
  basePath,
  // nginx의 `location /admin/` (proxy_pass, 슬래시로 끝남)는 슬래시 없는 요청을
  // 항상 301로 슬래시를 붙여 리다이렉트한다(nginx 표준 동작). Next의 기본값인
  // trailingSlash:false 와 반대 방향이라 basePath 사용 시 무한 리다이렉트 루프가
  // 생기므로, basePath가 있을 때는 trailingSlash도 true로 맞춘다.
  trailingSlash: Boolean(basePath),
};

export default nextConfig;
