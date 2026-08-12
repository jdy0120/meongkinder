// packages/ui/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * ⚠️ tailwind-merge 에 **커스텀 글자 크기 토큰을 등록해야 한다** (job-053).
 *
 * job-052 가 타이포 스케일을 `text-label`/`text-body`/`text-name` 으로 새로 정의했는데,
 * `twMerge` 는 기본 설정에서 그 이름들을 모른다. 모르는 `text-*` 는 **글자색 그룹**으로
 * 분류되므로, `cn()` 이 같은 그룹의 앞 클래스를 지운다:
 *
 *   cva(variant: "bg-primary text-primary-foreground", size: "… text-body")
 *   → twMerge 가 text-body 를 색으로 보고 **text-primary-foreground 를 제거**
 *   → 딥그린 배경 위에 색 지정이 없어 `--foreground`(#24211e, 거의 검정)가 상속된다
 *
 * 실제로 **앱의 모든 버튼**이 이 상태였다(`text-destructive` 도 같이 사라졌다). 토큰도
 * 대비도 전부 정상인데 **클래스가 화면에 도달하지 못한** 것이라, 팔레트만 들여다봐서는
 * 찾을 수 없는 부류다. 아래 등록으로 크기는 크기끼리, 색은 색끼리 병합된다.
 *
 * 새 크기 토큰을 `tokens.css` 에 추가하면 **여기에도 반드시 함께 추가할 것.**
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // tokens.css 의 `@theme` 에 선언된 글자 크기 전부 (label/body/name/title/display).
      "font-size": [{ text: ["label", "body", "name", "title", "display"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
