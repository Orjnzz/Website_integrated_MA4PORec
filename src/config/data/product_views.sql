-- Tạo bảng product_views để lưu trữ thông tin về các sản phẩm được click
CREATE TABLE IF NOT EXISTS `product_views` (
  `view_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_variant_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,  -- Có thể NULL nếu người dùng chưa đăng nhập
  `view_date` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`view_id`),
  KEY `fk_product_views_product_variant_id` (`product_variant_id`),
  KEY `fk_product_views_category_id` (`category_id`),
  KEY `fk_product_views_customer_id` (`customer_id`),
  CONSTRAINT `fk_product_views_product_variant_id` FOREIGN KEY (`product_variant_id`) REFERENCES `product_variants` (`product_variant_id`),
  CONSTRAINT `fk_product_views_category_id` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`),
  CONSTRAINT `fk_product_views_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_vietnamese_ci;