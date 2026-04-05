import * as bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string, rounds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(plain, rounds, (err, hash) => {
      if (err) reject(err);
      else if (hash !== undefined) resolve(hash);
      else reject(new Error('bcrypt.hash returned no hash'));
    });
  });
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    bcrypt.compare(plain, hash, (err, same) => {
      if (err) reject(err);
      else resolve(same === true);
    });
  });
}
