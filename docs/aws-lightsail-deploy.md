# RTPG na AWS Lightsail

Este caminho publica o RTPG em uma instancia Lightsail com Node.js, PM2, Nginx e banco SQLite em disco persistente.

## Criar a instancia

1. Abra o Amazon Lightsail.
2. Crie uma instancia Linux Ubuntu.
3. Escolha um plano com pelo menos 1 GB de RAM.
4. Crie e anexe um Static IP.
5. Libere HTTP 80, HTTPS 443 e SSH 22 no firewall da instancia.

## Instalar o RTPG

No SSH da instancia, execute:

```bash
curl -fsSL https://raw.githubusercontent.com/ruamnilton-cyber/profeng/codex/rtpg-transfer/deploy/aws-lightsail/install-rtpg.sh | bash
```

## DNS no Route 53

Crie ou atualize estes registros na Hosted Zone de `rtpgapp.com`:

```text
Tipo: A
Nome: rtpgapp.com
Valor: IP_ESTATICO_DA_LIGHTSAIL
TTL: 300
```

```text
Tipo: A
Nome: www.rtpgapp.com
Valor: IP_ESTATICO_DA_LIGHTSAIL
TTL: 300
```

## SSL

Depois que o DNS responder para o IP da instancia, rode:

```bash
curl -fsSL https://raw.githubusercontent.com/ruamnilton-cyber/profeng/codex/rtpg-transfer/deploy/aws-lightsail/enable-ssl.sh | bash
```

## Validacao

```bash
curl http://127.0.0.1:3333/api/health
curl http://rtpgapp.com/api/health
curl https://rtpgapp.com/api/health
```

## Dados

O banco e os arquivos ficam em:

```text
/opt/rtpg-data
```

Nao apague esse diretorio. Para backup rapido:

```bash
sudo tar -czf /opt/rtpg-backup-$(date +%Y%m%d-%H%M%S).tar.gz /opt/rtpg-data
```
