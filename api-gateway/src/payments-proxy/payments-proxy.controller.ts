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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/auth.guard';
import { ProxyService } from 'src/proxy/service/proxy.service';

interface GatewayJwtUser {
  userId: string;
  email: string;
  role: string;
}

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Consulta pagamento por orderId (proxy para payments-service)',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Pagamento retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente ou inválido' })
  @ApiResponse({
    status: 404,
    description: 'Pagamento não encontrado para o pedido',
  })
  getPaymentByOrderId(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: Request,
  ) {
    const user = req.user as GatewayJwtUser | undefined;
    const auth = req.headers.authorization;

    return this.proxyService.proxyRequest(
      'payments',
      'get',
      `/payments/${orderId}`,
      undefined,
      auth ? { Authorization: auth } : {},
      user && {
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
    );
  }
}
