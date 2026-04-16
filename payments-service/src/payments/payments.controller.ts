import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUser } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':orderId')
  @ApiOperation({ summary: 'Consulta pagamento por pedido (titular do token)' })
  getPaymentByOrderId(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: Request & { user: JwtUser },
  ): Promise<{
    id: string;
    orderId: string;
    status: 'approved' | 'rejected';
  }> {
    return this.paymentsService.getByOrderIdForUser(orderId, req.user.id);
  }
}
