import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Fund } from './fund.entity';
import { Strategy } from './strategy.entity';
import { TransactionType, TransactionStatus } from './enums';

@Entity('transactions')
export class Transaction {
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

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  shares: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  price: number;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Column({ nullable: true })
  order_id: string;

  @CreateDateColumn()
  submitted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date;

  @Column({ nullable: true })
  strategy_id: string;

  @ManyToOne(() => Strategy, { nullable: true })
  @JoinColumn({ name: 'strategy_id' })
  strategy: Strategy;
}
