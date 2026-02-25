import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Fund } from './fund.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  fund_code: string;

  @ManyToOne(() => Fund)
  @JoinColumn({ name: 'fund_code' })
  fund: Fund;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0 })
  shares: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  avg_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  current_value: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  profit: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  profit_rate: number;

  @UpdateDateColumn()
  updated_at: Date;
}
