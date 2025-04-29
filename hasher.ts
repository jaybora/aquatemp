import * as crypto from 'crypto';

export function hashPassword(plainPassword: string | null): string {
  if (!plainPassword) {
    return '';
  }
  // Convert the plain password to a buffer
  const passwordBuffer = Buffer.from(plainPassword, 'utf-8');

  // Create an MD5 hash
  const md5hash = crypto.createHash('md5');
  md5hash.update(passwordBuffer);

  // Get the hashed password as a hexadecimal string
  return md5hash.digest('hex');
}
