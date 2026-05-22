// Vercel 서버리스 함수 - 네이버 검색 API 프록시 (CORS 우회)
export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const response = await fetch(
    `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&sort=comment`,
    {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: '네이버 검색 API 오류' });
  }

  const data = await response.json();
  res.setHeader('Cache-Control', 's-maxage=60');
  res.json(data);
}
