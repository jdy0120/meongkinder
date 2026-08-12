import { Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "../../notification/constants";
import { NotificationService } from "../../notification/services/notification.service";
import { startOfDay } from "../utils/date";

interface FanOutTarget {
  petId: string;
  petName: string;
  // job-040: 아직 계정이 연결되지 않은 아이(미가입 보호자)는 null.
  // 팬아웃은 계정이 아니라 guardianPhone 으로 나가므로 그대로 발송된다.
  userId: string | null;
  guardianPhone: string | null;
}

const webUrl = () => process.env.WEB_URL ?? "http://localhost:3001";

/**
 * 게시물 발행 시 팬아웃 알림.
 *
 * 인스타는 `1게시물 → 모든 팔로워`지만 여기는 `1게시물 → 태그된 아이의 보호자`다.
 * 선생님은 하루 12번 올리는데 보호자 20명이 각자 "우리 아이 사진"을 받는 구조가 여기서 완성된다.
 *
 * 보호자에게 앱 설치를 요구하지 않는 것이 도입 장벽 관점의 핵심 선택이라, 푸시가 아니라
 * 알림톡으로 도달한다. 대신 건당 원가가 있으므로 **아이 1마리당 하루 1건**만 보낸다.
 */
@Injectable()
export class FeedNotificationService {
  private readonly logger = new Logger(FeedNotificationService.name);

  constructor(private readonly notificationService: NotificationService) {}

  async fanOut(targets: FanOutTarget[], date: Date) {
    const day = startOfDay(date);
    const feedUrl = `${webUrl()}/feed`;

    for (const target of targets) {
      // 같은 아이에게 오늘 이미 보냈으면 건너뛴다 — 사진 한 장마다 알림이 가면
      // 보호자에겐 알림 폭탄, 우리에겐 건당 원가가 그대로 곱해진다.
      const alreadySent = await this.notificationService.hasSentToday({
        petId: target.petId,
        type: NOTIFICATION_TYPE.FEED_POST,
        date: day,
      });
      if (alreadySent) {
        this.logger.debug(
          `오늘 이미 피드 알림을 보낸 아이라 건너뜁니다. petId=${target.petId}`,
        );
        continue;
      }

      await this.notificationService.notifyFeedPost({
        userId: target.userId,
        petId: target.petId,
        petName: target.petName,
        guardianPhone: target.guardianPhone,
        feedUrl,
      });
    }
  }
}
