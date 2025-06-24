// choose comment filter option
function chooseOption(event) {
    const buttons = document.querySelectorAll('.filter__option button')
    buttons.forEach(button => {
        if (button.style.fontWeight == '500') {
            button.style.border = '1px solid var(--outline-gray)'
            button.style.fontWeight = '400'
            button.style.color = 'var(--black)'
        }
    })

    const target = event.currentTarget
    target.style.border = '1px solid var(--dollar-red)'
    target.style.fontWeight = '500'
    target.style.color = 'var(--dollar-red)'
}

// open images modal
function openImageModal(event) {
    const imageModal = document.querySelector('.image-modal')
    imageModal.style.display = 'flex'
}

// show all description
function showAll(event) {
    const button = event.currentTarget
    const description = document.querySelector('.detail--bottom')
    if (description.classList.contains('default')) {
        description.classList.remove('default')
        description.classList.add('full')
        button.innerHTML = 'Ẩn bớt'
    } else if (description.classList.contains('full')) {
        description.classList.remove('full')
        description.classList.add('default')
        button.innerHTML = 'Xem thêm'
    }
}

// Tạo sự kiện change cho phần tử
function triggerChangeEvent(element) {
    var event = new Event('change', {
        bubbles: true
    })
    element.dispatchEvent(event)
}

// Minus quantity
function minus(event) {
    const input = event.currentTarget.nextElementSibling
    input.value = Number(input.value) - 1
    triggerChangeEvent(input)
}

// Plus quantity
function add(event) {
    const input = event.currentTarget.previousElementSibling
    input.value = Number(input.value) + 1
    triggerChangeEvent(input)
}

// Change quantity
function changeQuantity(event) {
    const current = event.currentTarget

    const quantity = current.value
    const max = Number(current.max)
    const min = Number(current.min)

    if (quantity > max) {
        current.value = max
        const failModal = document.querySelector('.fail-modal')
        failModal.style.display = 'flex'
        setTimeout(() => failModal.style.display = 'none', 1000)
    }
    else if (quantity < min) {
        current.value = min
        const failModal = document.querySelector('.fail-modal')
        failModal.style.display = 'flex'
        setTimeout(() => failModal.style.display = 'none', 1000)
    }
}

const toCurrency = function (money) {
    let currency = money.toFixed(0).replace(/./g, function (c, i, a) {
        return i > 0 && c !== "," && (a.length - i) % 3 === 0 ? "." + c : c
    })
    return currency + 'đ'
}

// Tracking function to track product clicks
function trackProductClick(productVariantId, categoryId, productName) {
    if (!productVariantId) return;
    
    try {
        // Retrieve the current session's clicked products
        let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

        // Thêm thông tin sản phẩm vào danh sách nếu chưa có
        const productInfo = {
            product_variant_id: productVariantId,
            category_id: categoryId,
            product_name: productName, // Sửa từ productName thành product_name để nhất quán
            sended: false // Thêm trường sended mặc định là false
        };

        // Kiểm tra xem sản phẩm đã được click chưa (dựa trên product_variant_id)
        if (!clickedProducts.some(item => item.product_variant_id === productVariantId)) {
            clickedProducts.push(productInfo);
            // Save the updated list back to local storage
            localStorage.setItem('clickedProducts', JSON.stringify(clickedProducts));
            console.log('Tracked product:', productVariantId, 'in category:', categoryId);
        }
    } catch (error) {
        console.error('Error tracking product:', error);
    }
}

// Open cart success modal
const formAddCart = document.getElementById('buy-form')
const addCartBtn = document.querySelector('.detail__add-btn')
const buyNowBtn = document.querySelector('.detail__buy-btn')
const cartSuccessModal = document.querySelector('.success-modal')

formAddCart.addEventListener('submit', (event) => event.preventDefault())

// Sự kiện Spam tỷ lần addCart
let addCartSpam = 0
localStorage.setItem('addCartSpam', JSON.stringify(addCartSpam))

// Cập nhật cart lần đầu tiên, count Cart, list dropdown cart
addCartBtn.addEventListener('click', function firstAddCart (event) {
    const product_variant_id = document.getElementById('product_variant_id').value
    const quantity = document.getElementById('quantity').value

    const cart = {
        'product_variant_id': product_variant_id,
        'cart_quantity': quantity,
    }

    fetch('/order/addCart', {
        method: 'POST',
        body: JSON.stringify(cart),
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(res => res.json())
        .then(back => {
            if (back.status == 'error') {
                window.alert('Vui lòng thử lại sau');
            } else if (back.status == "NotAuth") {
                window.location.href = "/auth/login"
            } else if (back.status == "success") {
                const cartSuccessModal = document.querySelector('.success-modal')
                cartSuccessModal.style.display = 'flex'
                setTimeout(() => {
                    cartSuccessModal.style.display = 'none'
                }, 1000)

                fetch('/general/count_cart', {
                    method: 'GET',
                })
                    .then(res => res.json())
                    .then(countCartData => {
                        const countCartEle = document.querySelector('.header__cart__number-badge')
                        countCartEle.innerHTML = countCartData.countCart

                        const dropdownCart = document.querySelector('.dropdown-cart__content')
                        const cartTitle = dropdownCart.querySelector('.dropdown-cart__content-title')
                        const emptyNoti = dropdownCart.querySelector('.dropdown-cart--empty')
                        const cartBtn = dropdownCart.querySelector('.btn-cart')

                        if (emptyNoti) {
                            emptyNoti.remove()
                            cartTitle.style.visibility = 'visible'
                            cartBtn.style.visibility = 'visible'
                        }

                        fetch('/general/short_cart_list', {
                            method: 'GET',
                        })
                            .then(res => res.json())
                            .then(shortCartListData => {
                                const cartDropdownItem = document.querySelector('.dropdown-cart__content')
                                cartDropdownItem.querySelectorAll('.cart-dropdown__block').forEach(item => {
                                    item.remove()
                                })

                                if (shortCartListData.status == 'success') {
                                    shortCartListData.shortCartList.slice(0, 5).forEach(cartItem => {
                                        let dropdownCartItem = document.createElement('div')
                                        dropdownCartItem.classList.add('cart-dropdown__block')

                                        let cartDropdownPrice
                                        let cartDropdownPriceDel
                                        if (cartItem.discount_amount) {
                                            cartDropdownPrice = toCurrency(Math.round(cartItem.product_variant_price - cartItem.product_variant_price * (cartItem.discount_amount / 100)))
                                            cartDropdownPriceDel = toCurrency(cartItem.product_variant_price)
                                        }
                                        else {
                                            cartDropdownPrice = toCurrency(cartItem.product_variant_price)
                                            cartDropdownPriceDel = ''
                                        }

                                        dropdownCartItem.innerHTML =
                                            `<a href="/search/${cartItem.product_variant_id}?category_id=${cartItem.category_id}" class="cart-dropdown__main">
                                                <img class="cart-dropdown__img" src="/imgs/product_image/P${cartItem.product_id}/${cartItem.product_avt_img}" alt="${cartItem.product_name}">
                                                <div class="cart-dropdown__content">
                                                    <span class="cart-dropdown__product-name">${cartItem.product_name}</span>
                                                    <div class="cart-dropdown__div">
                                                        <span class="cart-dropdown__variant">Loại: ${cartItem.product_variant_name} </span>
                                                        <span class="cart-dropdown__price">${cartDropdownPrice}<small>${cartDropdownPriceDel}</small></span>
                                                    </div>
                                                </div>
                                            </a>`

                                        let cartDropdownTitle = cartDropdownItem.querySelector('.btn-cart')
                                        cartDropdownTitle.before(dropdownCartItem)
                                    })
                                }
                            })
                    })
            }
        })

        // Tặt sự kiện cập nhật cart lần đầu tiên, bật sự kiện checkSpam
        addCartBtn.removeEventListener("click", firstAddCart) 
        // addCartBtn.addEventListener("click", spamAddCart)  
        addCartBtn.addEventListener("click", function spamAddCart () {
            const quantity = document.getElementById('quantity').value
        
            let quantitySpam = Number(JSON.parse(localStorage.getItem('addCartSpam')))
            const cartSuccessModal = document.querySelector('.success-modal')
                cartSuccessModal.style.display = 'flex'
                setTimeout(() => {
                    cartSuccessModal.style.display = 'none'
                }, 1000)
            quantitySpam += Number(quantity)
            localStorage.removeItem('addCartSpam')
            localStorage.setItem('addCartSpam', JSON.stringify(quantitySpam))
            // console.log(JSON.parse(localStorage.getItem('addCartSpam')))
        })

        window.addEventListener("load", async () => {
            const product_variant_id = document.getElementById('product_variant_id').value
            const cart = {
                'product_variant_id': product_variant_id,
                'cart_quantity': Number(JSON.parse(localStorage.getItem('addCartSpam')))
            }
        
            await fetch('/order/addCart', {
                method: 'POST',
                body: JSON.stringify(cart),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        
            localStorage.removeItem('addCartSpam')
        })

        window.addEventListener("beforeunload", async () => {
            const product_variant_id = document.getElementById('product_variant_id').value
            const cart = {
                'product_variant_id': product_variant_id,
                'cart_quantity': Number(JSON.parse(localStorage.getItem('addCartSpam')))
            }
        
            await fetch('/order/addCart', {
                method: 'POST',
                body: JSON.stringify(cart),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        
            localStorage.removeItem('addCartSpam')
        })
})





buyNowBtn.addEventListener('click', () => {
    const product_variant_id = document.getElementById('product_variant_id').value
    const quantity = document.getElementById('quantity').value

    const formDataArray = [{
        'product_variant_id': Number(product_variant_id),
        'order_detail_quantity': Number(quantity),
    }]

    let formDataArrayString = JSON.stringify(formDataArray)

    localStorage.setItem('formDataArray', formDataArrayString)
    window.location.href = '/order/information'
})

// Run
const commentImages = document.querySelectorAll('.comment__pictures img')
commentImages.forEach(image => image.addEventListener('click', openImageModal))

// apply css to default comment filter option 
const buttons = document.querySelectorAll('.filter__option button')
buttons[0].style.border = '1px solid var(--dollar-red)'
buttons[0].style.fontWeight = '500'
buttons[0].style.color = 'var(--dollar-red)'

// Track the current product view
document.addEventListener('DOMContentLoaded', function() {
    // Track the current product detail view - sử dụng input ẩn có chứa ID sản phẩm 
    const productVariantId = document.getElementById('product_variant_id')?.value;
    const categoryIdInput = document.querySelector('input[name="category_id"]')?.value;
    // Sử dụng URL params nếu không tìm thấy input
    const categoryId = categoryIdInput || new URLSearchParams(window.location.search).get('category_id');
    
    // Lấy tên sản phẩm từ tiêu đề của trang
    const productName = document.querySelector('.title h1')?.textContent.trim() || 'Unknown Product';
    
    if (productVariantId && categoryId) {
        trackProductClick(productVariantId, categoryId, productName);
        console.log('Tracked product view:', productVariantId, 'in category:', categoryId, 'name:', productName);
    }
    
    // Track related product clicks - sản phẩm liên quan và đề xuất
    document.querySelectorAll('.similar-products .carousel__card-main, .tip-products .product__card-main').forEach((productLink) => {
        productLink.addEventListener('click', function() {
            // Lấy product_variant_id từ URL của thẻ a
            const href = this.getAttribute('href');
            if (href && href.includes('/')) {
                const productVariantId = href.split('/')[2].split('?')[0];
                const categoryId = new URLSearchParams(href.split('?')[1]).get('category_id');
                // Lấy product_name từ thẻ h4 trong carousel__card-main hoặc product__card-main
                const productNameElement = this.querySelector('h4');                
                const productName = productNameElement && productNameElement.getAttribute('title') 
                ? productNameElement.getAttribute('title') 
                : (productNameElement ? productNameElement.textContent.trim() : 'Unknown Product');

                trackProductClick(productVariantId, categoryId, productName);
            }
        });
    });

    // Lấy danh sách sản phẩm đã click từ localStorage
    let clickedProducts = JSON.parse(localStorage.getItem('clickedProducts')) || [];

    // Add debug logging to see tracked products
    console.log('===== TRACKING DEBUGGING (product detail) =====');
    console.log('Products tracked in this session:', clickedProducts);
    console.log('=======================================');

    // Đã loại bỏ phần gửi dữ liệu đến server - chỉ gửi khi người dùng quay về trang chủ
});