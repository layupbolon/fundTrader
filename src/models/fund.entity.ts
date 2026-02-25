import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('funds')
export class Fund {
  @PrimaryColumn()
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  manager: string;

  @UpdateDateColumn()
  updated_at: Date;
}
