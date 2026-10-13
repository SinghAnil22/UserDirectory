export interface User {
  id: number;
  name: string;
  age: number;
  city: string;
  state: string;
  pincode: string;
}

export type NewUser = Omit<User, 'id'>;

export type Role = 'Admin' | 'Guest';

export interface CurrentUser {
  email: string | null;
  roles: Role[];
}
