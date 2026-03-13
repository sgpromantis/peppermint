# Docker Install

Requirements:

- Docker
- Docker Compose

```docker
version: "3.1"

services:
  promantis_postgres:
    container_name: promantis_postgres
    image: postgres:latest
    restart: always
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: promantis
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: promantis

  promantis:
    container_name: promantis
    image: ghcr.io/sgpromantis/promantis:latest
    ports:
      - 3000:3000
      - 5003:5003
    restart: always
    depends_on:
      - promantis_postgres
    environment:
      DB_USERNAME: "promantis"
      DB_PASSWORD: "1234"
      DB_HOST: "promantis_postgres"
      SECRET: 'promantis4life'

volumes:
 pgdata:
```

After you have created the docker-compose.yml file, run the following command:

```bash
docker-compose up -d
```

Then you can access the application at http://your-server-ip:3000

The default login credentials for the admin account are:

```
admin@admin.com
1234
```
