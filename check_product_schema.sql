-- SQL запрос для проверки структуры таблицы product в EverShop
-- Выполнить в PostgreSQL для проверки наличия полей length, width, height

-- Проверка всех колонок таблицы product
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product' 
ORDER BY ordinal_position;

-- Проверка конкретных полей размеров
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'length'
    ) THEN 'length EXISTS' ELSE 'length NOT EXISTS' END as length_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'width'
    ) THEN 'width EXISTS' ELSE 'width NOT EXISTS' END as width_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'height'
    ) THEN 'height EXISTS' ELSE 'height NOT EXISTS' END as height_check,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product' AND column_name = 'weight'
    ) THEN 'weight EXISTS' ELSE 'weight NOT EXISTS' END as weight_check;
