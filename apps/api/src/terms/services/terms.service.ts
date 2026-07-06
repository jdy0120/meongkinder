import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@template/database";
import { SubmitTermsAgreementDto } from "../dtos";

@Injectable()
export class TermsService {
  /** 활성화된 약관 목록 조회 */
  async listActiveTerms() {
    return prisma.terms.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** 사용자의 약관 동의 이력 제출 */
  async submitAgreements(userId: string, dto: SubmitTermsAgreementDto) {
    const termsIds = dto.agreements.map((a) => a.termsId);

    // 존재하는 약관들인지 사전 확인
    const existingTerms = await prisma.terms.findMany({
      where: { id: { in: termsIds } },
    });

    if (existingTerms.length !== termsIds.length) {
      throw new BadRequestException(
        "존재하지 않는 약관 ID가 포함되어 있습니다.",
      );
    }

    const agreements = await prisma.$transaction(async (tx) => {
      const createdAgreements = [];
      for (const ag of dto.agreements) {
        const created = await tx.userTermsAgreement.create({
          data: {
            userId,
            termsId: ag.termsId,
            isAgreed: ag.isAgreed,
          },
        });
        createdAgreements.push(created);
      }
      return createdAgreements;
    });

    return {
      message: "약관 동의가 등록되었습니다.",
      agreements,
    };
  }
}
