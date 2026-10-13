// Shape of the JWT body this app signs (auth.service) and verifies
// (jwt.strategy). Declared once so neither side has to treat the decoded
// token as `any`.
export type JwtPayload = {
  sub: string;
  email: string;
};
