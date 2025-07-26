import { OrderStatus } from 'generated/prisma';
import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatusList } from '../enum/order.enum';

export class ChangeOrderStatusDto {
  @IsUUID(4)
  id: string;

  @IsEnum(OrderStatusList, {
    message: `Valid status are ${JSON.stringify(OrderStatusList)}`,
  })
  status: OrderStatus;
}
