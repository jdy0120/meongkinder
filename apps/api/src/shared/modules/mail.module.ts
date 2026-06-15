import { Module, Global } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";

@Global()
@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
      defaults: {
        from:
          process.env.EMAIL_FROM ||
          '"Media Art Nation" <no-reply@artnation.co>',
      },
    }),
  ],
  exports: [MailerModule],
})
export class MailModule {}
