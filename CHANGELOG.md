## [2.0.0](https://github.com/Keimelion/Keimelion-API/compare/v1.0.0...v2.0.0) (2026-11-02)

### ⚠ BREAKING CHANGES

* no live admins consume this today, and the Backoffice

### Features

* /admin/items accept categories input (KEI-104) ([#43](https://github.com/Keimelion/Keimelion-API/issues/43)) ([8b25ca5](https://github.com/Keimelion/Keimelion-API/commit/8b25ca57d1bf9d83b6297046e16d40e075638f93))
* /admin/items accept tags input (KEI-108) ([#45](https://github.com/Keimelion/Keimelion-API/issues/45)) ([4613a74](https://github.com/Keimelion/Keimelion-API/commit/4613a74ccd8983ea054195b2b45d07651908f1d4))
* /admin/lists aggregates + GET /admin/lists/:id/items (KEI-110) ([#47](https://github.com/Keimelion/Keimelion-API/issues/47)) ([1b1faf0](https://github.com/Keimelion/Keimelion-API/commit/1b1faf0239de7688e09914367c192742c738d520))
* /admin/lists FX-normalized price aggregation via ?currency (KEI-113) ([#50](https://github.com/Keimelion/Keimelion-API/issues/50)) ([b0715b6](https://github.com/Keimelion/Keimelion-API/commit/b0715b6c7a915d425208741a1edb01132f92b858)), closes [#51](https://github.com/Keimelion/Keimelion-API/issues/51)
* /admin/tags create accepts strict { name, slug } like /admin/categories (KEI-109) ([#46](https://github.com/Keimelion/Keimelion-API/issues/46)) ([34b886c](https://github.com/Keimelion/Keimelion-API/commit/34b886c6e55853e7556ef0d3844a801fa03fa825)), closes [#30](https://github.com/Keimelion/Keimelion-API/issues/30)
* /admin/users allow sort by username (KEI-51) ([#23](https://github.com/Keimelion/Keimelion-API/issues/23)) ([2cf33d4](https://github.com/Keimelion/Keimelion-API/commit/2cf33d43facdf6abdef782c440891eb0e27f8272))
* /feedback endpoint with user context (KEI-114) ([#54](https://github.com/Keimelion/Keimelion-API/issues/54)) ([4f94a12](https://github.com/Keimelion/Keimelion-API/commit/4f94a121ee4c343ad7ff12f5171437cc443a1c5c))
* /list-items + /users multipart image upload (KEI-123) ([#56](https://github.com/Keimelion/Keimelion-API/issues/56)) ([e02fe68](https://github.com/Keimelion/Keimelion-API/commit/e02fe686a06b12afcf33765f62854478489740d0))
* /list-items/:id/reserve + /reservations/:id authenticated reservation flow (KEI-131) ([#61](https://github.com/Keimelion/Keimelion-API/issues/61)) ([22df1d2](https://github.com/Keimelion/Keimelion-API/commit/22df1d21a9a36293cab5f61e47d5641e5c18528c))
* /v1/admin/reservations CRUD + AdminItem/AdminUser enrichments (KEI-133) ([#62](https://github.com/Keimelion/Keimelion-API/issues/62)) ([d367059](https://github.com/Keimelion/Keimelion-API/commit/d367059e2daa2e02c5ea61177fce1e9452e7a458))
* /v1/admin/shops/:id detail endpoint with item sources (KEI-80) ([#34](https://github.com/Keimelion/Keimelion-API/issues/34)) ([c1ed0db](https://github.com/Keimelion/Keimelion-API/commit/c1ed0db73910104b75400c7f4f0f18b8407b5a27))
* /v1/categories CRUD + item-categories N:N + RGPD export (KEI-97) ([#38](https://github.com/Keimelion/Keimelion-API/issues/38)) ([b3561f9](https://github.com/Keimelion/Keimelion-API/commit/b3561f9e94bf23e40eee11fe2550cecd4c6330be))
* /v1/categories migrate to per-entity translations (KEI-102) ([#42](https://github.com/Keimelion/Keimelion-API/issues/42)) ([da271bc](https://github.com/Keimelion/Keimelion-API/commit/da271bc26d5d697c93b2f84efab9029bb57a03ac))
* /v1/items accept tags + categories on create (KEI-106) ([#44](https://github.com/Keimelion/Keimelion-API/issues/44)) ([ebc5bd2](https://github.com/Keimelion/Keimelion-API/commit/ebc5bd22d48b709503d215317dbbe77eb4da8c65))
* /v1/lists tags assignment + RGPD export (KEI-99) ([#40](https://github.com/Keimelion/Keimelion-API/issues/40)) ([835ca4c](https://github.com/Keimelion/Keimelion-API/commit/835ca4cf758c9bdb227d71b61c05f3eae8762a29))
* /v1/lists user-facing CRUD + RGPD lists.csv export (KEI-10) ([#37](https://github.com/Keimelion/Keimelion-API/issues/37)) ([9bf019f](https://github.com/Keimelion/Keimelion-API/commit/9bf019feb35413109e5b615d737d93dab67f8aa9))
* /v1/public/lists/:slug anonymous list read (KEI-130) ([#65](https://github.com/Keimelion/Keimelion-API/issues/65)) ([eeed116](https://github.com/Keimelion/Keimelion-API/commit/eeed1161c3c7cb6f78af9f96ceef61c039652c2e))
* /v1/tags user+admin CRUD + item assignment + RGPD export (KEI-98) ([#39](https://github.com/Keimelion/Keimelion-API/issues/39)) ([a372ac6](https://github.com/Keimelion/Keimelion-API/commit/a372ac6542cb739447c6864ea406a4a9772e0d90))
* /v1/users/me/reservations list caller's active reservations (KEI-132) ([#63](https://github.com/Keimelion/Keimelion-API/issues/63)) ([ec1790c](https://github.com/Keimelion/Keimelion-API/commit/ec1790c8a84db6c879ba459c10d82375cc4d3205))
* add occasion_types table + GET /occasion-types (KEI-11) ([#18](https://github.com/Keimelion/Keimelion-API/issues/18)) ([c33e08d](https://github.com/Keimelion/Keimelion-API/commit/c33e08d336e3b7c8424880fd18cdbaf9523a7764))
* add POST /v1/admin/users admin endpoint to create users (KEI-46) ([#16](https://github.com/Keimelion/Keimelion-API/issues/16)) ([22ca102](https://github.com/Keimelion/Keimelion-API/commit/22ca1029efe0f54f351a9cddd54e7403e02b90f3))
* add shops table + admin CRUD (KEI-73) ([#26](https://github.com/Keimelion/Keimelion-API/issues/26)) ([f6c2f1f](https://github.com/Keimelion/Keimelion-API/commit/f6c2f1fc924f85cdb07c41a620ca66951cbc37ae))
* admin CRUD endpoints for users (KEI-32) ([#3](https://github.com/Keimelion/Keimelion-API/issues/3)) ([00b5855](https://github.com/Keimelion/Keimelion-API/commit/00b5855bcbb5d92479f6aa709b9346f266ad5387))
* admin CRUD for occasion_types with translations (KEI-63) ([#21](https://github.com/Keimelion/Keimelion-API/issues/21)) ([5693e55](https://github.com/Keimelion/Keimelion-API/commit/5693e55f64d41133b3e30970d51f7d5ff0de8a81))
* admin id[eq|in] filters + admin/reservations expose listItem.itemId (KEI-134) ([#64](https://github.com/Keimelion/Keimelion-API/issues/64)) ([9b9d550](https://github.com/Keimelion/Keimelion-API/commit/9b9d550fe292782b3b790ad5718b0e1c39727c25))
* admin items CRUD + item_sources + moderation_status pgEnum (KEI-68) ([#29](https://github.com/Keimelion/Keimelion-API/issues/29)) ([5f4e96d](https://github.com/Keimelion/Keimelion-API/commit/5f4e96d1f66f120fb769f5396a23755343e6db35))
* admin list items endpoint returns item.tags + item.categories (KEI-111 catch-up) ([#49](https://github.com/Keimelion/Keimelion-API/issues/49)) ([1588e0c](https://github.com/Keimelion/Keimelion-API/commit/1588e0ca11ef165c3b6a1008d88287e817ab8f7e))
* admin lists CRUD (KEI-76) ([#30](https://github.com/Keimelion/Keimelion-API/issues/30)) ([55bac0f](https://github.com/Keimelion/Keimelion-API/commit/55bac0fefa9755bf40e34b21e5d5a9158ef1466e))
* admin-lists accept title[ilike] filter (KEI-111 catch-up) ([#48](https://github.com/Keimelion/Keimelion-API/issues/48)) ([7801753](https://github.com/Keimelion/Keimelion-API/commit/7801753abb550018ea0916af92e07a265aa577ae))
* api i18n infra + migrate occasion_types to per-entity translations (KEI-58) ([#20](https://github.com/Keimelion/Keimelion-API/issues/20)) ([0ebf73c](https://github.com/Keimelion/Keimelion-API/commit/0ebf73c352c0270da6d5d9569e0fd2e51b485df8))
* cron job to delete expired JWT tokens (KEI-34) ([#5](https://github.com/Keimelion/Keimelion-API/issues/5)) ([63f8a47](https://github.com/Keimelion/Keimelion-API/commit/63f8a4796afd00b7612fc17c21c8ba78938a91bb))
* cron job to hard-delete inactive users with RGPD audit trail (KEI-33) ([#6](https://github.com/Keimelion/Keimelion-API/issues/6)) ([3ce6438](https://github.com/Keimelion/Keimelion-API/commit/3ce6438bafedeee70af3cc8cd72b9f968dbfeaf2))
* cron/jobs/fx-rates-refresh daily ECB refresh job (KEI-117) ([#53](https://github.com/Keimelion/Keimelion-API/issues/53)) ([5e4b743](https://github.com/Keimelion/Keimelion-API/commit/5e4b74337d651bcfcce25df3aef5a394fc2cc277))
* DELETE /users/me RGPD account deletion (KEI-8) ([#13](https://github.com/Keimelion/Keimelion-API/issues/13)) ([08a18ca](https://github.com/Keimelion/Keimelion-API/commit/08a18cac8fa8160a6dd0e5866906f5f95c5b5873)), closes [#4](https://github.com/Keimelion/Keimelion-API/issues/4) [#5](https://github.com/Keimelion/Keimelion-API/issues/5)
* filters and sort on GET /v1/admin/users (KEI-45) ([#15](https://github.com/Keimelion/Keimelion-API/issues/15)) ([cb98b6c](https://github.com/Keimelion/Keimelion-API/commit/cb98b6c78bfbef1f2cde3c2591eb9e5348b10f13))
* GET /users/me/export RGPD data export (KEI-9) ([#14](https://github.com/Keimelion/Keimelion-API/issues/14)) ([b2efc19](https://github.com/Keimelion/Keimelion-API/commit/b2efc19e597e1fdfff4a45226097e638a14d84a2))
* implement email/password authentication and restructure project… ([#2](https://github.com/Keimelion/Keimelion-API/issues/2)) ([91c09ad](https://github.com/Keimelion/Keimelion-API/commit/91c09ad6000c61bd9d06c4d42ae855c4e853c4e0))
* item_sources unique shop constraint + 409 CONFLICT (KEI-95) ([#36](https://github.com/Keimelion/Keimelion-API/issues/36)) ([38ea403](https://github.com/Keimelion/Keimelion-API/commit/38ea403d35f7b3cd611f637f9c7e57399bc0baf1))
* items + item_sources + list_items CRUD (KEI-12) ([#24](https://github.com/Keimelion/Keimelion-API/issues/24)) ([6a1b3c6](https://github.com/Keimelion/Keimelion-API/commit/6a1b3c6ec64d084426e80b7d62f6c7b9267466fc))
* operator-based generic filter framework for list endpoints (KEI-49) ([#27](https://github.com/Keimelion/Keimelion-API/issues/27)) ([0a52152](https://github.com/Keimelion/Keimelion-API/commit/0a5215209aebcf5744af2a1d3aa776781543b312))
* POST /auth/forgot-password & POST /auth/reset-password (KEI-5) ([#7](https://github.com/Keimelion/Keimelion-API/issues/7)) ([967b1e0](https://github.com/Keimelion/Keimelion-API/commit/967b1e09899de086562791f86fe835c629aad42a))
* POST /auth/logout with JWT token whitelist (KEI-28) ([#4](https://github.com/Keimelion/Keimelion-API/issues/4)) ([ca59527](https://github.com/Keimelion/Keimelion-API/commit/ca5952753f866eaf7a345e41c43fc56b826ee573))
* POST /users/me/change-password with atomic token revocation (KEI-27) ([#8](https://github.com/Keimelion/Keimelion-API/issues/8)) ([55ceba8](https://github.com/Keimelion/Keimelion-API/commit/55ceba8b8337ca92700f2839978d6e8163276105))
* POST /v1/auth/refresh with refresh token rotation (KEI-26) ([#9](https://github.com/Keimelion/Keimelion-API/issues/9)) ([6e6ac42](https://github.com/Keimelion/Keimelion-API/commit/6e6ac42f0fb6660ec6526ba78b07f8a6e55ba394))
* revoke user tokens on admin role change (KEI-47) ([#17](https://github.com/Keimelion/Keimelion-API/issues/17)) ([3fe787e](https://github.com/Keimelion/Keimelion-API/commit/3fe787ecfab8448facbc7b6f1a24ff4648eec4f9))
* set up Drizzle ORM with users schema, migrations, and seed scripts ([#1](https://github.com/Keimelion/Keimelion-API/issues/1)) ([8e3cdb7](https://github.com/Keimelion/Keimelion-API/commit/8e3cdb737632bac77513dfb6fe32ed0839ad660d))
* users default_currency_code preference + admin FX default resolution (KEI-118) ([#52](https://github.com/Keimelion/Keimelion-API/issues/52)) ([f57e76c](https://github.com/Keimelion/Keimelion-API/commit/f57e76c8885f9248c3c7d360c64527fa769173ba))
* validation.ts expose Zod issues in metadata (KEI-94) ([#35](https://github.com/Keimelion/Keimelion-API/issues/35)) ([39efb1f](https://github.com/Keimelion/Keimelion-API/commit/39efb1fad42f1a91cdbc8ae5be2a5d8904bbaa0f))

### Bug Fixes

* /admin/items expose uploaded image via image_id FK (KEI-149) ([#81](https://github.com/Keimelion/Keimelion-API/issues/81)) ([68dc3fa](https://github.com/Keimelion/Keimelion-API/commit/68dc3faa720820e5bf40e914c110011589c559f2)), closes [#2](https://github.com/Keimelion/Keimelion-API/issues/2)
* admin/{users,lists/:id/items} load avatarImage + image JOINs (KEI-124) ([#67](https://github.com/Keimelion/Keimelion-API/issues/67)) ([8b6d4f4](https://github.com/Keimelion/Keimelion-API/commit/8b6d4f43eae4548e7123271b2cc827796ca5e698))
* app dev-only serveStatic mount for /uploads/* (KEI-124) ([#68](https://github.com/Keimelion/Keimelion-API/issues/68)) ([d8adcbe](https://github.com/Keimelion/Keimelion-API/commit/d8adcbe36153088e2354d1794f10e4d27e58a131)), closes [#67](https://github.com/Keimelion/Keimelion-API/issues/67) [#67](https://github.com/Keimelion/Keimelion-API/issues/67)
* app override CORP to cross-origin on /uploads/* (KEI-124) ([#69](https://github.com/Keimelion/Keimelion-API/issues/69)) ([9e675c5](https://github.com/Keimelion/Keimelion-API/commit/9e675c59af5526eb883b9ce1073e0e84ce4306e1)), closes [#68](https://github.com/Keimelion/Keimelion-API/issues/68)
* db/migrations remove explicit transactions rejected by postgres.js ([#51](https://github.com/Keimelion/Keimelion-API/issues/51)) ([d96ff9d](https://github.com/Keimelion/Keimelion-API/commit/d96ff9d04d2df90ab513bad628e8b4a94915df4d))

# 1.0.0 (2026-04-03)


### Bug Fixes

* run vitest in single-pass mode in pre-commit hook ([f0ec024](https://github.com/Keimelion/Keimelion-API/commit/f0ec024bce3191fea199e008a7f66e95a0848d16))


### Features

* project foundation with health endpoint and tooling ([0747e64](https://github.com/Keimelion/Keimelion-API/commit/0747e646dfa3e4e6675d5019d39ff7087030a54c))
