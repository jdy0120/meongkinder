# Project Context

## ⚠️ 필수 규칙 — 에이전트 공통

- 아래 규칙을 위반하는 코드는 절대 생성하지 말 것.
- 이 프로젝트는 **초석이 되는 모노레포 템플릿**입니다. AI를 통한 신규 서비스 개발 시, 템플릿의 전체 구조와 아키텍처 원칙을 무너뜨리지 않고 새로운 기능들을 확장(Scale-out)해 나가는 것을 목표로 합니다.
- **의존성 추가, 주요 아키텍처 변경, 허용 범위 외 패키지(`packages/`) 핵심 설정 수정 시에는 반드시 사용자에게 먼저 확인을 요청**해야 합니다.
- **TypeScript `any` 타입 사용 절대 금지**: 어떠한 경우에도 `any` 타입의 사용을 엄격히 금지합니다. 반드시 구체적인 타입(인터페이스, 제네릭 등)을 명시하거나, 타입을 알 수 없는 경우 `unknown`을 활용하여 타입 안정성을 확보해야 합니다.

---

## 🏗️ 프로젝트 모노레포 구조

이 프로젝트는 pnpm workspaces를 사용하는 모노레포입니다.

```text
apps/
  web/             # 프론트엔드 (Next.js)
    src/app/       # App Router 라우팅 (페이지)
    src/views/     # 페이지 단위 뷰 컴포넌트
    src/widgets/   # 여러 feature/entity를 조합한 독립 UI 블록
    src/features/  # 사용자 인터랙션 단위 기능 (로그인, 장바구니 추가 등)
    src/entities/  # 비즈니스 도메인 엔티티 (User, Product 등)
    src/shared/    # 프론트엔드 공통 모듈 (유틸, 타입, 공용 UI 등)
  api/             # 백엔드 (NestJS)
    src/           # NestJS 모듈, 컨트롤러, 서비스 등 (자유롭게 확장)
    src/main.ts    # 서버 진입점
packages/
  ui/              # 디자인 시스템 및 shadcn UI 컴포넌트 (@template/ui)
  database/        # Prisma 스키마 및 DB 클라이언트 (@template/database)
    prisma/schema/ # 다중 파일 스키마
  shared/          # 백엔드/프론트엔드 공통 타입, DTO, 모델 등 (@template/shared)
```

---

## 🎨 프론트엔드 (apps/web) 개발 규칙

### FSD (Feature-Sliced Design) 아키텍처 (필수 준수)

단방향 의존성 규칙을 반드시 지킵니다. 상위 레이어는 하위 레이어를 import 할 수 있지만, 역은 불가능합니다.
의존성 방향: `app` ➡️ `views` ➡️ `widgets` ➡️ `features` ➡️ `entities` ➡️ `shared`

- **`entities/`**: 핵심 도메인 데이터와 관련된 컴포넌트, 훅, 타입.
- **`features/`**: 구체적인 비즈니스 가치를 제공하는 사용자 상호작용 (예: `AuthForm`, `AddToCart`).
- **`widgets/`**: 여러 feature와 entity를 결합하여 만든 독립적인 UI 블록 (예: `Header`, `UserProfileCard`).
- **`views/`**: 하나의 완벽한 페이지를 구성하는 레이어.

### 페이지(`app/`) 생성 규칙 (필수)

- `app/` 하위의 `page.tsx` 또는 `layout.tsx`는 **반드시 `views/` 폴더의 컴포넌트만 import**하여 렌더링해야 합니다.
- `page.tsx` 내부에 직접적인 UI 구조(div 등)나 비즈니스 로직을 작성하는 것을 엄격히 금지합니다.

✅ **올바른 예시:**
```tsx
// app/dashboard/page.tsx
import DashboardView from "@/views/dashboard";

export default function DashboardPage() {
  return <DashboardView />;
}
```

❌ **잘못된 예시:**
```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>직접 UI 및 레이아웃 작성 금지</div>; // 🚫
}
```

### 디자인 및 UI 컴포넌트 규칙 (필수)

- UI 컴포넌트는 반드시 `packages/ui` (`@template/ui`) 패키지에서 import 하여 사용합니다. (shadcn 기반)
- `packages/ui` 내부의 컴포넌트는 모든 서비스에서 공통으로 쓰는 **디자인 시스템이므로 직접 수정하는 것을 지양**합니다. (버그 수정이나 명시적인 공통 디자인 시스템 확장 요구 시에만 수정)
- 개별 페이지나 컴포넌트에서의 커스터마이징은 상위 레이어(features/widgets/views)에서 `className` (Tailwind CSS)을 주입하여 처리합니다.

---

## ⚙️ 백엔드 (apps/api) 개발 규칙

### 도메인 중심 모듈 아키텍처 (필수 준수)

- `apps/api/src/` 내부는 **도메인(기능)별로 폴더를 나누어 모듈을 구성**해야 합니다 (예: `users/`, `products/`, `auth/`).
- **모듈 내부 디렉토리 구조**: 각각의 도메인 모듈은 반드시 다음 4가지 하위 폴더로 역할을 명확히 분리해야 합니다.
  1. **`routes/`**: API 라우트 경로 및 엔드포인트 정의.
  2. **`controllers/`**: HTTP 요청/응답 처리. **컨트롤러 내부에는 직접적인 기능 연산을 작성하지 않으며, 반드시 `services`를 호출**하여 처리 결과를 반환해야 합니다.
  3. **`services/`**: 핵심 비즈니스 로직 및 데이터베이스 접근 등 모든 **기능적인 연산**을 담당합니다.
  4. **`dtos/`**: 데이터 전송 객체. **모든 API 엔드포인트마다 반드시 DTO가 존재해야 하며, 이를 기반으로 Swagger 문서가 완벽하게 구성(Decorators 사용)될 수 있도록 작성해야 합니다.**

✅ **올바른 도메인 모듈 구조 예시 (`auth` 도메인):**
```text
apps/api/src/auth/
  ├── auth.module.ts
  ├── routes/
  ├── controllers/
  ├── services/
  └── dtos/
```

✅ **수정·생성 가능**: `apps/api/src/` 내부 전체. 새로운 도메인 기능 추가 시 위 구조를 엄격히 따릅니다. 공통으로 사용하는 Guard, Interceptor, Decorator, Filter 등은 `src/shared/` 하위에 위치시킵니다.

### 파일 업로드 아키텍처 규칙 (필수 준수)

파일 업로드가 포함된 새로운 기능을 개발할 때는 다이렉트 업로드를 지양하고, **반드시 2-Step 파일 업로드 방식**을 설계 및 구현해야 합니다.
1. **임시 저장 (1-Step)**: 공통 파일 모듈(`apps/api/src/shared/file`)의 임시 저장 API를 활용하여 클라이언트가 파일을 먼저 업로드하고 `Temp File ID`를 발급받습니다.
2. **실제 저장 (2-Step)**: 클라이언트가 실제 비즈니스 도메인 API(예: 게시글 작성, 프로필 변경)를 호출할 때 발급받은 `Temp File ID`를 함께 전달합니다. 도메인의 Service에서는 주입받은 `FileService.moveTempsToUploads()` 메서드를 호출하여 임시 파일을 실제 저장소로 이동시키고 영구 저장 처리를 완료해야 합니다.

---

## 🗄️ 데이터베이스 및 공통 패키지 규칙

### 데이터베이스 (`packages/database`)
- DB 스키마 변경이 필요할 경우, `packages/database/prisma/schema/` 내부의 `*.prisma` 파일들을 수정하거나 새로운 스키마 파일을 생성합니다. (Prisma 다중 파일 스키마 적용 중)
- **Prisma Generator 사용**: 이 프로젝트는 Prisma의 generator를 통해 모델 스키마 코드를 자동 생성하여 사용하고 있습니다. 
- 🚫 `packages/database/` 내부의 기본 설정 파일은 함부로 수정하지 않습니다.

### End-to-End 타입 안정성 (`packages/shared`) - ⚠️ 매우 중요
- 프론트엔드의 **Request 파라미터** 및 **Response 인터페이스**는 반드시 **Prisma에서 생성된 스키마 모델을 기반**으로 도출되어야 합니다.
- 도메인별로 만들어진 모든 Request / Response 타입 및 인터페이스는 무조건 **`packages/shared/types/`** 폴더 내부에 도메인별로 분류하여 명확히 정의되어야 합니다.
- **인터페이스 공유 원칙**:
  - **백엔드 (`apps/api`)**: 컨트롤러나 서비스에서 API 응답을 반환할 때, `packages/shared/types/`에서 정의된 인터페이스를 그대로 사용해야 합니다.
  - **프론트엔드 (`apps/web`)**: 백엔드의 API를 호출하고 응답 데이터를 받을 때 임의로 인터페이스를 재정의하지 않고, 백엔드와 정확히 동일하게 `packages/shared/types/`에서 정의된 인터페이스를 import 하여 사용해야 합니다.
- 이 원칙을 통해 클라이언트와 서버 간의 타입(Type) 불일치를 원천 차단하고 완벽한 End-to-End 타입 안정성을 보장합니다.
