-- O runtime hospedado suporta no maximo 100.000 iteracoes de PBKDF2.
-- Os usuarios de teste continuam com a senha provisoria 1234.
UPDATE "Funcionario"
SET "senhaHash" = 'pbkdf2_sha256$100000$61ab1480b59003be6ab311af707e8cf4$e7fe8ad007bb03950ce43de4c6df3f790c5edfd818b9727b659072b53589d889'
WHERE "senhaHash" LIKE 'pbkdf2_sha256$120000$%';

PRAGMA optimize;
