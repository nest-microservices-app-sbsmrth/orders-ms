import { OrderStatus } from 'generated/prisma';

export interface OrderWithProducts {
  id: string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus;
  paid: boolean;
  createdAt: Date;
  updatedAt: Date;
  orderItems: {
    name: string;
    productId: number;
    quantity: number;
    price: number;
  }[];
}
