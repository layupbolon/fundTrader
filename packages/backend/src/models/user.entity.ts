import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ type: 'jsonb', nullable: true })
  encrypted_credentials: any;

  @CreateDateColumn()
  created_at: Date;
}
