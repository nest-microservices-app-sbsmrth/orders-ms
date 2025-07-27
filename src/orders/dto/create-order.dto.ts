import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  /*
  @IsEnum(OrderStatusList, {
    message: `Possible status values are ${JSON.stringify(OrderStatusList)}`,
  })
  @IsOptional()
  status: OrderStatus = OrderStatus.PENDING;
  */

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
