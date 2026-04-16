import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentRecordStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PaymentRejectionReason {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  FRAUD_SUSPECTED = 'fraud_suspected',
  GATEWAY_ERROR = 'gateway_error',
  VALIDATION_ERROR = 'validation_error',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'uuid', unique: true })
  orderId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({
    type: 'enum',
    enum: PaymentRecordStatus,
  })
  status: PaymentRecordStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
