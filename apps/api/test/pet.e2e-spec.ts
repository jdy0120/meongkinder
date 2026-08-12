import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { prisma, prismaConnect, prismaDisconnect } from "@pawlog/database";

import { AppModule } from "../src/shared/modules/app.module";
import { setupApplication } from "../src/shared/configs/app.setup";

// setupApplication 이 붙이는 글로벌 프리픽스: api/${PROJECT_NAME}
const PREFIX = `/api/${process.env.PROJECT_NAME}`;
const V1_AUTH = `${PREFIX}/v1/auth`;
const V1_PETS = `${PREFIX}/v1/pets`;

const password = "password1234";

/** TransformInterceptor 가 감싸는 응답 형태 */
type PetBody = {
  result: boolean;
  message: string;
  data: { pet: { id: string; userId: string; name: string } };
};
type PetListBody = {
  result: boolean;
  data: {
    items: { id: string; userId: string; name: string }[];
    meta: { total: number };
  };
};

describe("Pet (e2e)", () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    // 안전 가드 — deleteMany 가 운영/개발 DB 를 지우는 사고 방지(방어 심화).
    if (!(process.env.DATABASE_URL ?? "").includes("template_test")) {
      throw new Error(
        "[e2e] DATABASE_URL 이 테스트 DB(template_test)가 아니라 중단합니다.",
      );
    }

    await prismaConnect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupApplication(app);
    await app.init();

    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
    await prismaDisconnect();
  });

  const signupAndLogin = async (email: string, nickname: string) => {
    const session = request.agent(server());
    await session
      .post(`${V1_AUTH}/signup`)
      .send({ email, password, nickname })
      .expect(201);
    await session
      .post(`${V1_AUTH}/login`)
      .send({ email, password })
      .expect(200);
    return session;
  };

  describe("GET /v1/pets — owner-scoped 1:N 목록 조회", () => {
    it("한 보호자가 등록한 여러 펫을 모두 반환한다", async () => {
      const session = await signupAndLogin(
        "owner-many@example.com",
        "owner-many",
      );

      const names = ["첫째", "둘째", "셋째"];
      for (const name of names) {
        const res = await session
          .post(V1_PETS)
          .send({ name, species: "DOG" })
          .expect(201);
        expect((res.body as PetBody).data.pet.name).toBe(name);
      }

      const res = await session.get(V1_PETS).expect(200);
      const body = res.body as PetListBody;
      expect(body.data.meta.total).toBe(3);
      expect(body.data.items.map((p) => p.name).sort()).toEqual(names.sort());
    });

    it("다른 보호자의 펫은 서로 격리된다 (owner-scoped)", async () => {
      const sessionA = await signupAndLogin("owner-a@example.com", "owner-a");
      const sessionB = await signupAndLogin("owner-b@example.com", "owner-b");

      await sessionA
        .post(V1_PETS)
        .send({ name: "A-pet", species: "DOG" })
        .expect(201);
      await sessionB
        .post(V1_PETS)
        .send({ name: "B-pet-1", species: "CAT" })
        .expect(201);
      await sessionB
        .post(V1_PETS)
        .send({ name: "B-pet-2", species: "CAT" })
        .expect(201);

      const resA = await sessionA.get(V1_PETS).expect(200);
      const bodyA = resA.body as PetListBody;
      expect(bodyA.data.meta.total).toBe(1);
      expect(bodyA.data.items.every((p) => p.name === "A-pet")).toBe(true);

      const resB = await sessionB.get(V1_PETS).expect(200);
      const bodyB = resB.body as PetListBody;
      expect(bodyB.data.meta.total).toBe(2);
      expect(bodyB.data.items.map((p) => p.name).sort()).toEqual([
        "B-pet-1",
        "B-pet-2",
      ]);
    });

    it("인증 없이 요청하면 401", async () => {
      await request(server()).get(V1_PETS).expect(401);
    });
  });

  describe("GET/PATCH/DELETE /v1/pets/:id — 상세·수정·삭제 (본인 소유만)", () => {
    it("상세 조회: 등록한 필드가 그대로 반환된다", async () => {
      const session = await signupAndLogin(
        "owner-detail@example.com",
        "owner-detail",
      );

      const createRes = await session
        .post(V1_PETS)
        .send({ name: "탐정", species: "DOG", breed: "poodle" })
        .expect(201);
      const petId = (createRes.body as PetBody).data.pet.id;

      const res = await session.get(`${V1_PETS}/${petId}`).expect(200);
      const body = res.body as PetBody;
      expect(body.data.pet.id).toBe(petId);
      expect(body.data.pet.name).toBe("탐정");
    });

    it("수정: 이름을 변경하면 반영된다", async () => {
      const session = await signupAndLogin(
        "owner-update@example.com",
        "owner-update",
      );

      const createRes = await session
        .post(V1_PETS)
        .send({ name: "이전이름", species: "CAT" })
        .expect(201);
      const petId = (createRes.body as PetBody).data.pet.id;

      const updateRes = await session
        .patch(`${V1_PETS}/${petId}`)
        .send({ name: "새이름" })
        .expect(200);
      expect((updateRes.body as PetBody).data.pet.name).toBe("새이름");

      const res = await session.get(`${V1_PETS}/${petId}`).expect(200);
      expect((res.body as PetBody).data.pet.name).toBe("새이름");
    });

    it("삭제: 삭제 후 상세 조회는 404", async () => {
      const session = await signupAndLogin(
        "owner-delete@example.com",
        "owner-delete",
      );

      const createRes = await session
        .post(V1_PETS)
        .send({ name: "삭제될펫", species: "DOG" })
        .expect(201);
      const petId = (createRes.body as PetBody).data.pet.id;

      await session.delete(`${V1_PETS}/${petId}`).expect(200);
      await session.get(`${V1_PETS}/${petId}`).expect(404);
    });

    it("다른 보호자의 펫은 조회/수정/삭제 모두 404 (owner-scoped)", async () => {
      const sessionA = await signupAndLogin(
        "owner-iso-a@example.com",
        "owner-iso-a",
      );
      const sessionB = await signupAndLogin(
        "owner-iso-b@example.com",
        "owner-iso-b",
      );

      const createRes = await sessionA
        .post(V1_PETS)
        .send({ name: "A만의펫", species: "DOG" })
        .expect(201);
      const petId = (createRes.body as PetBody).data.pet.id;

      await sessionB.get(`${V1_PETS}/${petId}`).expect(404);
      await sessionB
        .patch(`${V1_PETS}/${petId}`)
        .send({ name: "가로채기" })
        .expect(404);
      await sessionB.delete(`${V1_PETS}/${petId}`).expect(404);

      // A 입장에서는 여전히 정상 조회된다 (B 의 시도로 영향받지 않음)
      const res = await sessionA.get(`${V1_PETS}/${petId}`).expect(200);
      expect((res.body as PetBody).data.pet.name).toBe("A만의펫");
    });
  });
});
