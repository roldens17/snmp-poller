FROM golang:1.21-alpine AS builder
WORKDIR /src
RUN apk add --no-cache build-base

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/snmp-poller ./cmd/snmp-poller

FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /out/snmp-poller /usr/local/bin/snmp-poller

EXPOSE 8080 9105
ENTRYPOINT ["/usr/local/bin/snmp-poller"]
