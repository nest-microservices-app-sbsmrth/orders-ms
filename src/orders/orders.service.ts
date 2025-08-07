import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateOrderDto,
  OrderPaginationDto,
  ChangeOrderStatusDto,
  PaidOrderDto,
} from './dto';
import { OrderStatus, PrismaClient } from 'generated/prisma';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  constructor(
    @Inject(NATS_SERVICE)
    private readonly natsClient: ClientProxy,
  ) {
    super();
  }

  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async create(createOrderDto: CreateOrderDto): Promise<OrderWithProducts> {
    try {
      const products = await firstValueFrom<
        { price: number; quantity: number; id: number; name: string }[]
      >(
        this.natsClient.send(
          'validate_products',
          createOrderDto.items.map((item) => item.productId),
        ),
      );

      const updatedOrderItems = createOrderDto.items.map((item) => {
        const product = products.find(
          (product) => product.id === item.productId,
        );

        return {
          ...item,
          price: product?.price || 0,
        };
      });

      const totalItems = updatedOrderItems.reduce(
        (total, item) => total + item.quantity,
        0,
      );

      const totalAmount = updatedOrderItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      );

      const order = await this.order.create({
        data: {
          totalItems,
          totalAmount,
          OrderItem: {
            createMany: {
              data: updatedOrderItems,
            },
          },
        },
        include: {
          // OrderItem: true, // Retrieve the order items in the response
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      const { OrderItem, ...orderData } = order;

      return {
        ...orderData,
        orderItems: OrderItem.map((item) => {
          const productName =
            products.find((product) => product.id === item.productId)?.name ||
            '';

          return {
            ...item,
            name: productName,
          };
        }),
      };
    } catch (error) {
      this.logger.error('Error creating order: ', error);
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Error creating order.',
      });
    }

    /*
      // return products; -> If we just return like this, no firstValueFrom is needed.
      Cause nest detects it is an observable and wait for it to resolve.
      If we return it in an object, nest will not automatically unwrap the observable
      and we will need to use firstValueFrom to get the value.

      return {
        service: 'Orders MS',
        products,
      }

    */
  }

  async createPaymentSession(orderWithProducts: OrderWithProducts) {
    const paymentSession: {
      cancelUrl: string;
      successUrl: string;
      url: string;
    } = await firstValueFrom(
      this.natsClient.send('create.payment.session', {
        orderId: orderWithProducts.id,
        currency: 'usd',
        items: orderWithProducts.orderItems.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      }),
    );

    return {
      cancelUrl: paymentSession.cancelUrl,
      successUrl: paymentSession.successUrl,
      url: paymentSession.url, // payment url
    };
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status,
      },
    });

    const currentPage = orderPaginationDto.page ?? 1;
    const perPage = orderPaginationDto.limit ?? 10;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status: orderPaginationDto.status,
        },
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItem: {
          select: {
            quantity: true,
            productId: true,
            price: true,
          },
        },
      },
    });

    if (!order) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id ${id} not found`,
      });
    }

    const { OrderItem, ...orderData } = order;

    const products = await firstValueFrom<
      { price: number; quantity: number; id: number; name: string }[]
    >(
      this.natsClient.send(
        'validate_products',
        order.OrderItem.map((item) => item.productId),
      ),
    );

    const updatedOrderItems = OrderItem.map((item) => {
      const product = products.find((product) => product.id === item.productId);

      return {
        ...item,
        name: product?.name,
      };
    });

    return {
      ...orderData,
      orderItems: updatedOrderItems,
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);
    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status: status },
    });
  }

  async handlePaidOrder(paidOrderDto: PaidOrderDto) {
    return await this.$transaction(async (prisma) => {
      // Update order status

      const { id: orderId } = await prisma.order.update({
        where: { id: paidOrderDto.orderId },
        data: { status: OrderStatus.PAID, paid: true },
      });

      // Payment creation with receipt

      const payment = await prisma.orderPayment.create({
        data: {
          orderId,
          stripeChargeId: paidOrderDto.stripePaymentId,
          receipt: {
            create: {
              receiptUrl: paidOrderDto.receiptUrl,
            },
          },
        },
        include: {
          receipt: true,
        },
      });

      return {
        orderId,
        paymentId: payment.id,
        receiptId: payment.receipt?.id,
        receiptUrl: payment.receipt?.receiptUrl,
      };
    });
  }
}
