-- 맛집지도 Supabase 스키마 v2.0
-- Supabase SQL Editor에서 실행하세요

-- 식당 메인 테이블
CREATE TABLE restaurants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  address      text NOT NULL,
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  naver_url    text,
  status       text NOT NULL CHECK (status IN ('visited', 'wishlist')),
  source       text NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'recommendation')),
  recommender  text,
  memo         text,
  axis_taste   boolean DEFAULT false,
  axis_revisit boolean DEFAULT false,
  axis_unique  boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- 태그 (수준 태그 + 자유 태그)
CREATE TABLE tags (
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  tag           text NOT NULL,
  tag_type      text NOT NULL CHECK (tag_type IN ('level', 'free')),
  PRIMARY KEY (restaurant_id, tag)
);

-- 사진 URL (네이버 이미지 URL, 최대 3장)
CREATE TABLE photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  image_url     text NOT NULL,
  display_order smallint NOT NULL CHECK (display_order IN (1, 2, 3))
);

-- 기본 레이어 (백년가게, 리뷰 1만+) - Phase 6용
CREATE TABLE external_landmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  layer_type text NOT NULL CHECK (layer_type IN ('baeknyeon', 'review')),
  city       text NOT NULL,
  source_url text,
  created_at timestamptz DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: 개인·가족 앱이므로 anon 키로 전체 허용
-- 보안은 Vercel 환경변수로 관리하는 프론트 비밀번호로 처리
ALTER TABLE restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_landmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_restaurants" ON restaurants       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tags"        ON tags              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_photos"      ON photos            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_landmarks"   ON external_landmarks FOR ALL TO anon USING (true) WITH CHECK (true);
