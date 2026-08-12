import { Module } from "@nestjs/common";
import { NotificationModule } from "../notification/notification.module";
import { FileModule } from "../shared/file/file.module";
import { FeedController } from "./controllers/feed.controller";
import { FeedCaptionDraftService } from "./services/feed-caption-draft.service";
import { FeedCoverageService } from "./services/feed-coverage.service";
import { FeedDigestService } from "./services/feed-digest.service";
import { FeedNotificationService } from "./services/feed-notification.service";
import { FeedPostService } from "./services/feed-post.service";
import { FeedTagSuggestionService } from "./services/feed-tag-suggestion.service";

@Module({
  imports: [FileModule, NotificationModule],
  controllers: [FeedController],
  providers: [
    FeedPostService,
    FeedTagSuggestionService,
    FeedCaptionDraftService,
    FeedCoverageService,
    FeedDigestService,
    FeedNotificationService,
  ],
  exports: [FeedPostService, FeedCoverageService, FeedDigestService],
})
export class FeedModule {}
